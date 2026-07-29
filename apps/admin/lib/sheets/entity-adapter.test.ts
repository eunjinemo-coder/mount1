import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

// entity-adapter.ts 는 'server-only'(next 런타임 전용)를 side-effect import 한다.
// vitest(node) 환경엔 그 모듈이 없으므로 빈 모듈로 스텁 — 어댑터 로직만 검증(DI mock).
vi.mock('server-only', () => ({}));
import {
  buildSheetRow,
  columnLetterToIndex,
  contentHash,
  mappedFieldsForHash,
  parseSheetRow,
  processInboundRow,
  type InboundDeps,
  type InboundStore,
  type SheetLink,
} from '@mount/lib/sheets';
import { createInstallationAdapter } from './entity-adapter';
import { DEFAULT_INSTALLATION_COLUMN_MAP, toFields, type InstallationJobRow } from './mapping';

/**
 * 어댑터 단위테스트 — installation_jobs 를 mock supabase 클라이언트로 대체.
 * read/applyInbound(create·update)/archive + 엔진 결선(에코/삭제) + 왕복(에코) 정합.
 */

interface MockResult {
  data: unknown;
  error: { message: string } | null;
}

interface Captured {
  op?: 'insert' | 'update';
  values?: Record<string, unknown>;
  id?: string;
  selectCols?: string;
}

/** from()마다 새 빌더 · insert/update 값과 조회 id 를 captured 에 기록. */
function makeClient(results: {
  read?: MockResult;
  insert?: MockResult;
  update?: MockResult;
}): { client: SupabaseClient; captured: Captured } {
  const captured: Captured = {};
  function builder(): Record<string, unknown> {
    const b: Record<string, unknown> = {};
    b.select = (cols: string) => {
      captured.selectCols = cols;
      return b;
    };
    b.eq = (_col: string, val: string) => {
      captured.id = val;
      return b;
    };
    b.insert = (values: Record<string, unknown>) => {
      captured.op = 'insert';
      captured.values = values;
      return b;
    };
    b.update = (values: Record<string, unknown>) => {
      captured.op = 'update';
      captured.values = values;
      return b;
    };
    b.maybeSingle = () => Promise.resolve(results.read ?? { data: null, error: null });
    b.then = (
      resolve: (v: MockResult) => unknown,
      reject?: (e: unknown) => unknown,
    ) => {
      const res =
        captured.op === 'insert'
          ? (results.insert ?? { data: null, error: null })
          : (results.update ?? { data: null, error: null });
      return Promise.resolve(res).then(resolve, reject);
    };
    return b;
  }
  const client = { from: () => builder() } as unknown as SupabaseClient;
  return { client, captured };
}

const DB_ROW: InstallationJobRow = {
  id: 'j1',
  scheduled_install_date: '2026-07-10',
  received_date: '2026-07-01',
  move_date: null,
  visit_time: '오전',
  technician_name: '김기사',
  customer_phone: '010-1234-5678',
  customer_phone2: null,
  address: '서울 강남구',
  address_detail: '101동',
  customer_name: '홍길동',
  install_type: '벽걸이',
  install_content: '55인치',
  special_notes: '문 앞',
  updated_at: '2026-07-09T00:00:00.000Z',
};

describe('createInstallationAdapter.read', () => {
  it('installation_jobs 행 → EntityRecord(매핑필드 + updatedAt)', async () => {
    const { client } = makeClient({ read: { data: DB_ROW, error: null } });
    const adapter = createInstallationAdapter(client);
    const rec = await adapter.read('j1');
    expect(rec?.updatedAt).toBe('2026-07-09T00:00:00.000Z');
    expect(rec?.fields.customer_name).toBe('홍길동');
    expect(rec?.fields.customer_contact).toBe('010-1234-5678');
    expect(rec?.fields.scheduled_install_date).toBe('2026. 7. 10');
  });

  it('없는 행 → null', async () => {
    const { client } = makeClient({ read: { data: null, error: null } });
    const rec = await createInstallationAdapter(client).read('nope');
    expect(rec).toBeNull();
  });
});

describe('createInstallationAdapter.applyInbound — 신규 시트행 CREATE', () => {
  it('최소요건(성함) 충족 → installation_jobs 생성 + 새 id 반환', async () => {
    const { client, captured } = makeClient({ insert: { data: [{ id: 'new-1' }], error: null } });
    const adapter = createInstallationAdapter(client);
    const res = await adapter.applyInbound({
      entityId: null,
      fields: { customer_name: '이순신', customer_contact: '010-1', visit_time: '오후' },
    });
    expect(res).toEqual({ applied: true, entityId: 'new-1' });
    expect(captured.op).toBe('insert');
    // 필드키가 DB 컬럼으로(연락처 상이) 매핑되어 insert
    expect(captured.values).toMatchObject({
      customer_name: '이순신',
      customer_phone: '010-1',
      visit_time: '오후',
    });
  });

  it('최소요건 미충족(시공일자·성함 모두 없음) → 생성 거부(비파괴)', async () => {
    const { client, captured } = makeClient({});
    const res = await createInstallationAdapter(client).applyInbound({
      entityId: null,
      fields: { visit_time: '오전', install_type: '벽걸이' },
    });
    expect(res.applied).toBe(false);
    expect(res.entityId).toBeNull();
    expect(res.reason).toBe('create_requires_minimal_fields');
    expect(captured.op).toBeUndefined(); // insert 시도조차 안 함
  });
});

describe('createInstallationAdapter.applyInbound — 기존행 UPDATE', () => {
  it('매핑필드 → installation_jobs 갱신', async () => {
    const { client, captured } = makeClient({ update: { data: [{ id: 'j1' }], error: null } });
    const res = await createInstallationAdapter(client).applyInbound({
      entityId: 'j1',
      fields: { visit_time: '14:00', special_notes: '변경됨' },
    });
    expect(res).toEqual({ applied: true, entityId: 'j1' });
    expect(captured.op).toBe('update');
    expect(captured.id).toBe('j1');
    expect(captured.values).toEqual({ visit_time: '14:00', special_notes: '변경됨' });
  });

  it('반영할 매핑필드 없으면 no-op(update 안 함) applied=true', async () => {
    const { client, captured } = makeClient({});
    const res = await createInstallationAdapter(client).applyInbound({
      entityId: 'j1',
      fields: { status: 'completed' } as Record<string, string>, // status 는 시트 미동기화
    });
    expect(res).toEqual({ applied: true, entityId: 'j1' });
    expect(captured.op).toBeUndefined();
  });

  it('대상 행 부재 → entity_not_found(조용한 ok 금지)', async () => {
    const { client } = makeClient({ update: { data: [], error: null } });
    const res = await createInstallationAdapter(client).applyInbound({
      entityId: 'gone',
      fields: { visit_time: '오전' },
    });
    expect(res.applied).toBe(false);
    expect(res.reason).toBe('entity_not_found');
  });
});

describe('createInstallationAdapter.archive', () => {
  it("시트 행삭제 → 앱 상태 '취소' 표시(하드삭제 아님 — 데이터 보존)", async () => {
    const { client, captured } = makeClient({});
    await createInstallationAdapter(client).archive('j1');
    expect(captured.op).toBe('update');
    expect(captured.values).toEqual({ status: 'cancelled' });
  });
});

/** buildSheetRow 결과를 시트 값 배열로(RAW 저장 재현). */
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

describe('왕복(A~M) 정합 — buildSheetRow → parseSheetRow 동일', () => {
  it('13필드 라운드트립 — 엔진은 날짜를 ISO 로 표준화(자유서식 연락처 원문 보존)', () => {
    const fields = toFields(DB_ROW);
    const cells = buildSheetRow(fields, DEFAULT_INSTALLATION_COLUMN_MAP);
    const parsed = parseSheetRow(cellsToValues(cells), DEFAULT_INSTALLATION_COLUMN_MAP).fields;
    // toFields 는 시트 표기(YYYY. M. D)로 내보내고, 엔진 parseSheetRow 는 날짜를 ISO 정본으로
    // 표준화한다(해시/에코의 canonical = ISO). 날짜 필드만 ISO 기대, 나머지는 원문 그대로.
    expect(parsed).toEqual({
      ...fields,
      scheduled_install_date: '2026-07-10',
      received_date: '2026-07-01',
    });
  });

  it('outbox 해시 == 웹훅 해시(동일 필드셋·정본화)', () => {
    const fields = toFields(DB_ROW);
    const outHash = contentHash(mappedFieldsForHash(fields, DEFAULT_INSTALLATION_COLUMN_MAP));
    const cells = buildSheetRow(fields, DEFAULT_INSTALLATION_COLUMN_MAP);
    const webHash = contentHash(
      parseSheetRow(cellsToValues(cells), DEFAULT_INSTALLATION_COLUMN_MAP).fields,
    );
    expect(outHash).toBe(webHash);
  });
});

const LINK: SheetLink = {
  id: 'link-1',
  spreadsheetId: 'ss-1',
  sheetName: '시공',
  entity: 'installation',
  columnMap: DEFAULT_INSTALLATION_COLUMN_MAP,
  syncIdColumn: 'P',
  headerRow: 1,
  active: true,
};

describe('엔진 결선 — 어댑터를 processInboundRow 에 주입', () => {
  it('신규 시트행 → 어댑터 create 호출 → ok/writeBack=ok', async () => {
    const adapter = createInstallationAdapter(
      makeClient({ insert: { data: [{ id: 'created-1' }], error: null } }).client,
    );
    const setRows: unknown[] = [];
    const store: InboundStore = {
      dedupInsert: async () => ({ inserted: true }),
      getRowMapBySyncRow: async () => null, // 신규
      setRowMap: async (i) => {
        setRows.push(i);
      },
      markArchived: async () => undefined,
      log: async () => undefined,
    };
    const deps: InboundDeps = { store, adapter };
    const fields = { customer_name: '신규고객', scheduled_install_date: '2026-07-20' };
    const outcome = await processInboundRow(deps, {
      linkId: LINK.id,
      syncRowId: 'sync-new',
      fields,
      contentHash: contentHash(fields),
      sheetUpdatedAt: '2026-07-19T10:00:00.000Z',
    });
    expect(outcome.result).toBe('ok');
    expect(outcome.entityId).toBe('created-1');
    expect(outcome.writeBack).toBe('ok');
    expect(setRows).toHaveLength(1);
  });

  it('시트행 삭제 → 어댑터 archive(비파괴) + writeBack=archived', async () => {
    const { client, captured } = makeClient({});
    const adapter = createInstallationAdapter(client);
    const store: InboundStore = {
      dedupInsert: async () => ({ inserted: true }),
      getRowMapBySyncRow: async () => ({
        entityId: 'j1',
        lastSyncedHash: 'h',
        archivedAt: null,
      }),
      setRowMap: async () => undefined,
      markArchived: async () => undefined,
      log: async () => undefined,
    };
    const outcome = await processInboundRow(
      { store, adapter },
      {
        linkId: LINK.id,
        syncRowId: 'sync-e1',
        fields: {},
        contentHash: 'h2',
        sheetUpdatedAt: null,
        deleted: true,
      },
    );
    expect(outcome.result).toBe('ok');
    expect(outcome.writeBack).toBe('archived');
    // 보관 마킹(side-table) + 앱 상태 '취소' 표시(하드삭제 아님)
    expect(captured.op).toBe('update');
    expect(captured.values).toEqual({ status: 'cancelled' });
  });

  it('에코(incoming hash == last_synced_hash) → skipped_noop(앱 미반영)', async () => {
    const fields = toFields(DB_ROW);
    const echoHash = contentHash(mappedFieldsForHash(fields, LINK.columnMap));
    // read 가 호출되면 안 되지만, 호출돼도 무해하도록 DB_ROW 반환
    const adapter = createInstallationAdapter(makeClient({ read: { data: DB_ROW, error: null } }).client);
    let applyCalled = false;
    const wrapped = {
      ...adapter,
      applyInbound: async (i: Parameters<typeof adapter.applyInbound>[0]) => {
        applyCalled = true;
        return adapter.applyInbound(i);
      },
    };
    const store: InboundStore = {
      dedupInsert: async () => ({ inserted: true }),
      getRowMapBySyncRow: async () => ({ entityId: 'j1', lastSyncedHash: echoHash, archivedAt: null }),
      setRowMap: async () => undefined,
      markArchived: async () => undefined,
      log: async () => undefined,
    };
    const outcome = await processInboundRow(
      { store, adapter: wrapped },
      {
        linkId: LINK.id,
        syncRowId: 'sync-e1',
        fields,
        contentHash: echoHash,
        sheetUpdatedAt: '2026-07-10T10:00:00.000Z',
      },
    );
    expect(outcome.result).toBe('skipped_noop');
    expect(applyCalled).toBe(false);
  });
});
