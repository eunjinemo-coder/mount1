import { describe, expect, it, vi } from 'vitest';
import { contentHash } from './hash';
import { processInboundRow } from './inbound';
import type { InboundDeps, InboundPayload, InboundStore } from './inbound';
import type { EntityAdapter, EntityRecord } from './types';

const LINK_ID = 'link-1';
const SYNC = 'sync-abc';
const FIELDS = { scheduled_date: '2026-07-10', status: 'scheduled' };
const HASH = contentHash(FIELDS);

interface Harness {
  deps: InboundDeps;
  applyInbound: ReturnType<typeof vi.fn>;
  archive: ReturnType<typeof vi.fn>;
  dedup: ReturnType<typeof vi.fn>;
  setRowMap: ReturnType<typeof vi.fn>;
  markArchived: ReturnType<typeof vi.fn>;
  logs: { result: string; detail?: Record<string, unknown> }[];
}

function harness(opts: {
  rowMap?: { entityId: string; lastSyncedHash: string | null; archivedAt: string | null } | null;
  entity?: EntityRecord | null;
  dedupInserted?: boolean;
  applyResult?: { applied: boolean; entityId: string | null; reason?: string };
}): Harness {
  const applyInbound = vi.fn(async () => opts.applyResult ?? { applied: true, entityId: 'e1' });
  const archive = vi.fn(async () => undefined);
  const dedup = vi.fn(async () => ({ inserted: opts.dedupInserted ?? true }));
  const setRowMap = vi.fn(async () => undefined);
  const markArchived = vi.fn(async () => undefined);
  const logs: { result: string; detail?: Record<string, unknown> }[] = [];

  const adapter: EntityAdapter = {
    entity: 'installation',
    read: vi.fn(async () => opts.entity ?? null),
    applyInbound,
    archive,
  };

  const store: InboundStore = {
    dedupInsert: dedup,
    getRowMapBySyncRow: async () => opts.rowMap ?? null,
    setRowMap,
    markArchived,
    log: async (e) => {
      logs.push({ result: e.result, detail: e.detail });
    },
  };

  return {
    deps: { store, adapter },
    applyInbound,
    archive,
    dedup,
    setRowMap,
    markArchived,
    logs,
  };
}

function payload(over: Partial<InboundPayload> = {}): InboundPayload {
  return {
    linkId: LINK_ID,
    syncRowId: SYNC,
    fields: FIELDS,
    contentHash: HASH,
    sheetUpdatedAt: '2026-07-10T10:00:00Z',
    ...over,
  };
}

describe('processInboundRow — 시트→앱 정합성', () => {
  it('에코루프: incoming hash == last_synced_hash → skipped_noop, 앱 미반영', async () => {
    const h = harness({ rowMap: { entityId: 'e1', lastSyncedHash: HASH, archivedAt: null } });
    const out = await processInboundRow(h.deps, payload());
    expect(out.result).toBe('skipped_noop');
    expect(h.applyInbound).not.toHaveBeenCalled();
    expect(h.dedup).not.toHaveBeenCalled(); // 에코는 dedup 키 소모 안 함
    expect(h.logs.at(-1)?.detail?.reason).toBe('echo_loop');
  });

  it('멱등: dedup insert 실패(중복 수신) → skipped_noop', async () => {
    const h = harness({
      rowMap: { entityId: 'e1', lastSyncedHash: 'different', archivedAt: null },
      entity: { fields: FIELDS, updatedAt: '2026-07-10T09:00:00Z' },
      dedupInserted: false,
    });
    const out = await processInboundRow(h.deps, payload());
    expect(out.result).toBe('skipped_noop');
    expect(h.applyInbound).not.toHaveBeenCalled();
    expect(h.logs.at(-1)?.detail?.reason).toBe('duplicate');
  });

  it('충돌(동시수정): 시트 승 + conflict_sheet_won 로그 + 반영', async () => {
    const h = harness({
      rowMap: { entityId: 'e1', lastSyncedHash: 'old', archivedAt: null },
      entity: { fields: { status: 'assigned' }, updatedAt: '2026-07-10T10:00:02Z' }, // ±5초 이내
    });
    const out = await processInboundRow(h.deps, payload());
    expect(out.result).toBe('conflict_sheet_won');
    expect(h.applyInbound).toHaveBeenCalledTimes(1);
    expect(h.setRowMap).toHaveBeenCalled(); // last_synced_hash 갱신(다음 에코 차단)
  });

  it('충돌(앱이 확실히 최신): 앱 승 → 시트 미반영(비파괴) + conflict_app_won', async () => {
    const h = harness({
      rowMap: { entityId: 'e1', lastSyncedHash: 'old', archivedAt: null },
      entity: { fields: { status: 'assigned' }, updatedAt: '2026-07-10T10:05:00Z' }, // 앱이 5분 최신
    });
    const out = await processInboundRow(h.deps, payload());
    expect(out.result).toBe('conflict_app_won');
    expect(h.applyInbound).not.toHaveBeenCalled(); // 앱 데이터 보존
  });

  it('시트 확실히 최신 → ok 반영', async () => {
    const h = harness({
      rowMap: { entityId: 'e1', lastSyncedHash: 'old', archivedAt: null },
      entity: { fields: { status: 'assigned' }, updatedAt: '2026-07-10T09:00:00Z' }, // 시트가 1시간 최신
    });
    const out = await processInboundRow(h.deps, payload());
    expect(out.result).toBe('ok');
    expect(h.applyInbound).toHaveBeenCalled();
  });

  it('비파괴 삭제: deleted → archive 호출(하드삭제 금지선)', async () => {
    const h = harness({ rowMap: { entityId: 'e1', lastSyncedHash: 'x', archivedAt: null } });
    const out = await processInboundRow(h.deps, payload({ deleted: true }));
    expect(out.result).toBe('ok');
    expect(out.writeBack).toBe('archived');
    expect(h.archive).toHaveBeenCalledWith('e1');
    expect(h.markArchived).toHaveBeenCalled();
    // EntityAdapter 에 하드삭제 메서드 자체가 없음 → 파괴적 경로 부재
    expect((h.deps.adapter as unknown as Record<string, unknown>).delete).toBeUndefined();
  });

  it('이미 보관된 행 재삭제 → noop', async () => {
    const h = harness({ rowMap: { entityId: 'e1', lastSyncedHash: 'x', archivedAt: '2026-07-01T00:00:00Z' } });
    const out = await processInboundRow(h.deps, payload({ deleted: true }));
    expect(out.result).toBe('skipped_noop');
    expect(h.archive).not.toHaveBeenCalled();
  });

  it('형식오류(hasFormatWarnings) → 앱 미반영 + error + ⚠ 힌트', async () => {
    const h = harness({
      rowMap: { entityId: 'e1', lastSyncedHash: 'old', archivedAt: null },
      entity: { fields: {}, updatedAt: '2026-07-10T09:00:00Z' },
    });
    const out = await processInboundRow(h.deps, payload({ hasFormatWarnings: true }));
    expect(out.result).toBe('error');
    expect(out.writeBack).toBe('warn');
    expect(h.applyInbound).not.toHaveBeenCalled();
  });

  it('신규 시트행 → 앱 엔티티 생성 + rowMap 등록', async () => {
    const h = harness({ rowMap: null, applyResult: { applied: true, entityId: 'new-e' } });
    const out = await processInboundRow(h.deps, payload());
    expect(out.result).toBe('ok');
    expect(out.entityId).toBe('new-e');
    expect(h.setRowMap).toHaveBeenCalled();
  });

  it('신규행이나 생성 미지원(필수 PII 부재 등) → error, 비파괴', async () => {
    const h = harness({ rowMap: null, applyResult: { applied: false, entityId: null, reason: 'pii_required' } });
    const out = await processInboundRow(h.deps, payload());
    expect(out.result).toBe('error');
    expect(out.writeBack).toBe('warn');
  });
});
