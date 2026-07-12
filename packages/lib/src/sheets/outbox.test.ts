import { describe, expect, it, vi } from 'vitest';
import { processOutboxBatch } from './outbox';
import type { OutboxDeps, OutboxStore, SheetsApi } from './outbox';
import type { EntityAdapter, EntityRecord, OutboxRow, SheetLink } from './types';

const LINK: SheetLink = {
  id: 'link-1',
  spreadsheetId: 'ss-1',
  sheetName: '시공',
  entity: 'installation',
  columnMap: { B: 'scheduled_date', C: 'status' },
  syncIdColumn: 'A',
  headerRow: 1,
  active: true,
};

function makeAdapter(record: EntityRecord | null): EntityAdapter {
  return {
    entity: 'installation',
    read: vi.fn(async () => record),
    applyInbound: vi.fn(async () => ({ applied: true, entityId: 'e1' })),
    archive: vi.fn(async () => undefined),
  };
}

interface Harness {
  deps: OutboxDeps;
  upsert: ReturnType<typeof vi.fn>;
  markDone: ReturnType<typeof vi.fn>;
  markFailed: ReturnType<typeof vi.fn>;
  rowMaps: Map<string, { syncRowId: string; lastSyncedHash: string }>;
  logs: { result: string; detail?: Record<string, unknown> }[];
}

function harness(rows: OutboxRow[], adapter: EntityAdapter, sheetsOverride?: Partial<SheetsApi>): Harness {
  const upsert = vi.fn(async () => ({ upserted: true }));
  const markDone = vi.fn(async () => undefined);
  const markFailed = vi.fn(async () => undefined);
  const rowMaps = new Map<string, { syncRowId: string; lastSyncedHash: string }>();
  const logs: { result: string; detail?: Record<string, unknown> }[] = [];
  let uuidSeq = 0;

  const store: OutboxStore = {
    listPending: async () => rows,
    getLink: async (id) => (id === LINK.id ? LINK : null),
    ensureRowMap: async (linkId, entityId) => {
      const key = `${linkId}|${entityId}`;
      const ex = rowMaps.get(key);
      if (ex) return { syncRowId: ex.syncRowId };
      const syncRowId = `sync-${++uuidSeq}`;
      rowMaps.set(key, { syncRowId, lastSyncedHash: '' });
      return { syncRowId };
    },
    upsertRowMap: async ({ linkId, entityId, syncRowId, lastSyncedHash }) => {
      rowMaps.set(`${linkId}|${entityId}`, { syncRowId, lastSyncedHash });
    },
    markDone,
    markFailed,
    log: async (e) => {
      logs.push({ result: e.result, detail: e.detail });
    },
  };

  const sheets: SheetsApi = { upsertRow: upsert, ...sheetsOverride };
  const deps: OutboxDeps = { store, sheets, adapterFor: (e) => (e === 'installation' ? adapter : null) };
  return { deps, upsert, markDone, markFailed, rowMaps, logs };
}

function row(id: number, entityId: string): OutboxRow {
  return { id, linkId: LINK.id, entityId, contentHash: 'h', attempts: 0 };
}

describe('processOutboxBatch — 앱→시트 워커', () => {
  it('정상: 엔티티 read → 시트 upsert 1회 + rowMap.last_synced_hash 갱신', async () => {
    const adapter = makeAdapter({ fields: { scheduled_date: '2026-07-10', status: 'scheduled' }, updatedAt: null });
    const h = harness([row(1, 'e1')], adapter);
    const summary = await processOutboxBatch(h.deps);

    expect(summary.upserted).toBe(1);
    expect(h.upsert).toHaveBeenCalledTimes(1);
    expect(h.markDone).toHaveBeenCalledWith(1);
    // _sync_id 가 A열에 동봉
    const call = h.upsert.mock.calls[0]![0];
    expect(call.cells.A).toBe(call.syncRowId);
    expect(h.rowMaps.get('link-1|e1')?.lastSyncedHash).toBeDefined();
  });

  it('재실행 안전(coalesce): 같은 (link,entity) pending 2건 → 시트 upsert 1회, 둘 다 done', async () => {
    const adapter = makeAdapter({ fields: { status: 'assigned' }, updatedAt: null });
    const h = harness([row(1, 'e1'), row(2, 'e1')], adapter);
    const summary = await processOutboxBatch(h.deps);

    expect(h.upsert).toHaveBeenCalledTimes(1); // 최신 1건만 반영
    expect(summary.upserted).toBe(1);
    expect(summary.skipped).toBe(1); // superseded 접힘
    expect(h.markDone).toHaveBeenCalledWith(1);
    expect(h.markDone).toHaveBeenCalledWith(2);
  });

  it('기존 rowMap 있으면 같은 sync_row_id 재사용(append 아닌 update)', async () => {
    const adapter = makeAdapter({ fields: { status: 'assigned' }, updatedAt: null });
    const h = harness([row(1, 'e1')], adapter);
    h.rowMaps.set('link-1|e1', { syncRowId: 'existing-sync', lastSyncedHash: 'old' });
    await processOutboxBatch(h.deps);
    expect(h.upsert.mock.calls[0]![0].syncRowId).toBe('existing-sync');
  });

  it('엔티티 소멸 → 시트 반영 없이 noop done(비파괴)', async () => {
    const adapter = makeAdapter(null);
    const h = harness([row(1, 'gone')], adapter);
    const summary = await processOutboxBatch(h.deps);
    expect(h.upsert).not.toHaveBeenCalled();
    expect(h.markDone).toHaveBeenCalledWith(1);
    expect(summary.skipped).toBe(1);
  });

  it('시트 API 예외 → markFailed + error 로그(다음 틱 재시도)', async () => {
    const adapter = makeAdapter({ fields: { status: 'scheduled' }, updatedAt: null });
    const h = harness([row(1, 'e1')], adapter, {
      upsertRow: vi.fn(async () => {
        throw new Error('google 5xx');
      }),
    });
    const summary = await processOutboxBatch(h.deps);
    expect(summary.failed).toBe(1);
    expect(h.markFailed).toHaveBeenCalledWith(1, 'google 5xx');
    expect(h.logs.some((l) => l.result === 'error')).toBe(true);
  });

  it('비활성 링크 → noop done(재시도 무의미)', async () => {
    const adapter = makeAdapter({ fields: { status: 'scheduled' }, updatedAt: null });
    const h = harness([row(1, 'e1')], adapter);
    // getLink 를 비활성으로 오버라이드
    h.deps.store.getLink = async () => ({ ...LINK, active: false });
    const summary = await processOutboxBatch(h.deps);
    expect(h.upsert).not.toHaveBeenCalled();
    expect(summary.skipped).toBe(1);
  });
});
