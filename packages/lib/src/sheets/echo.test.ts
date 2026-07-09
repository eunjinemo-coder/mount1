import { describe, expect, it, vi } from 'vitest';
import {
  buildSheetRow,
  columnLetterToIndex,
  mappedFieldsForHash,
  parseSheetRow,
} from './column-map';
import { contentHash } from './hash';
import { processInboundRow } from './inbound';
import { processOutboxBatch } from './outbox';
import type { InboundDeps, InboundStore } from './inbound';
import type { OutboxDeps, OutboxStore } from './outbox';
import type { EntityAdapter, EntityRecord, OutboxRow, SheetLink } from './types';

/**
 * C1 회귀: 앱→시트 쓰기 값이 onEdit 로 그대로 돌아오면 에코 no-op 이 실제로 걸려야 한다.
 * 과거엔 outbox 가 어댑터 전체필드를, 웹훅이 매핑필드만 해시해 두 해시가 항상 어긋나
 * 정상흐름마다 허위 conflict_sheet_won + updated_at churn 이 났다. mappedFieldsForHash 로 정합.
 */

const LINK: SheetLink = {
  id: 'link-1',
  spreadsheetId: 'ss-1',
  sheetName: '시공',
  entity: 'installation',
  // status/날짜/뒷번호/메모 매핑 (10필드 중 4개만) — 필드셋 불일치를 유발하던 지점
  columnMap: { B: 'scheduled_date', C: 'status', D: 'phone_tail4', E: 'special_notes' },
  syncIdColumn: 'A',
  headerRow: 1,
  active: true,
};

// 어댑터는 매핑 안 된 필드(region/tv/technician 등)까지 포함한 "전체 10필드"를 낸다.
const ENTITY: EntityRecord = {
  fields: {
    status: 'scheduled',
    scheduled_date: '2026-07-10',
    phone_tail4: '5678',
    special_notes: '문 앞 배송',
    region_sido: '서울',
    region_sigungu: '강남구',
    tv_brand: 'LG',
    tv_model: 'OLED55',
    tv_size: '55',
    technician_name: '김기사',
  },
  updatedAt: '2026-07-09T00:00:00.000Z',
};

/** buildSheetRow 결과(+_sync_id)를 시트 값 배열로 (RAW 저장 재현). */
function cellsToValues(cells: Record<string, string>): string[] {
  let maxIdx = -1;
  for (const col of Object.keys(cells)) maxIdx = Math.max(maxIdx, columnLetterToIndex(col));
  const values = new Array(maxIdx + 1).fill('');
  for (const [col, v] of Object.entries(cells)) {
    const idx = columnLetterToIndex(col);
    if (idx >= 0) values[idx] = v;
  }
  return values;
}

describe('C1 에코루프 정합', () => {
  it('outbox 해시 == 웹훅 해시 (동일 필드셋·정본화)', () => {
    const outHash = contentHash(mappedFieldsForHash(ENTITY.fields, LINK.columnMap));

    // 웹훅이 보게 될 값: 시트에 실제 써진 셀 → parseSheetRow
    const cells = buildSheetRow(ENTITY.fields, LINK.columnMap);
    const webhookFields = parseSheetRow(cellsToValues(cells), LINK.columnMap).fields;
    const webHash = contentHash(webhookFields);

    expect(outHash).toBe(webHash);
  });

  it('앱→시트 쓰기가 onEdit 로 되돌아오면 skipped_noop (앱 미반영)', async () => {
    // 1) outbox 워커 실행 — 써진 cells 와 저장된 last_synced_hash 캡처
    let written: Record<string, string> = {};
    const upsert = vi.fn(async (input: { cells: Record<string, string> }) => {
      written = input.cells;
      return { upserted: true };
    });
    const rowMaps = new Map<string, { syncRowId: string; lastSyncedHash: string }>();
    const adapter: EntityAdapter = {
      entity: 'installation',
      read: vi.fn(async () => ENTITY),
      applyInbound: vi.fn(async () => ({ applied: true, entityId: 'e1' })),
      archive: vi.fn(async () => undefined),
    };
    const row: OutboxRow = { id: 1, linkId: LINK.id, entityId: 'e1', contentHash: 'x', attempts: 0 };
    const outStore: OutboxStore = {
      listPending: async () => [row],
      getLink: async () => LINK,
      ensureRowMap: async () => ({ syncRowId: 'sync-e1' }),
      upsertRowMap: async ({ linkId, entityId, syncRowId, lastSyncedHash }) => {
        rowMaps.set(`${linkId}|${entityId}`, { syncRowId, lastSyncedHash });
      },
      markDone: async () => undefined,
      markFailed: async () => undefined,
      log: async () => undefined,
    };
    const outDeps: OutboxDeps = {
      store: outStore,
      sheets: { upsertRow: upsert },
      adapterFor: () => adapter,
    };
    await processOutboxBatch(outDeps);

    const storedHash = rowMaps.get('link-1|e1')!.lastSyncedHash;
    expect(storedHash).toBeTruthy();

    // 2) 그 값이 onEdit 로 돌아온다 — 웹훅이 파싱해 해시
    const webhookFields = parseSheetRow(cellsToValues(written), LINK.columnMap).fields;
    const incomingHash = contentHash(webhookFields);
    expect(incomingHash).toBe(storedHash); // 에코 = 이미 아는 값

    // 3) inbound 처리 → skipped_noop, 앱 미반영
    const applyInbound = vi.fn(async () => ({ applied: true, entityId: 'e1' }));
    const inStore: InboundStore = {
      dedupInsert: vi.fn(async () => ({ inserted: true })),
      getRowMapBySyncRow: async () => ({ entityId: 'e1', lastSyncedHash: storedHash, archivedAt: null }),
      setRowMap: async () => undefined,
      markArchived: async () => undefined,
      log: async () => undefined,
    };
    const inDeps: InboundDeps = {
      store: inStore,
      adapter: { ...adapter, applyInbound },
    };
    const outcome = await processInboundRow(inDeps, {
      linkId: LINK.id,
      syncRowId: 'sync-e1',
      fields: webhookFields,
      contentHash: incomingHash,
      sheetUpdatedAt: '2026-07-10T10:00:00.000Z',
    });

    expect(outcome.result).toBe('skipped_noop');
    expect(applyInbound).not.toHaveBeenCalled();
    expect(inStore.dedupInsert).not.toHaveBeenCalled(); // 에코는 dedup 소모 없이 즉시 no-op
  });
});
