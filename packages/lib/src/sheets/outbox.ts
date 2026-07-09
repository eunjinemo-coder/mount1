/**
 * 앱→시트 outbox 워커 코어 (§2.1 · §2.2 · §2.4). 순수 · DI · 재실행 안전.
 *
 * 흐름:
 *   1. pending/failed(attempts<3) outbox 를 오래된순 폴링
 *   2. (link_id, entity_id) 로 coalesce — 같은 엔티티의 여러 pending 은 "최신 1건만" 반영,
 *      나머지는 superseded 로 done 처리 (재실행/연속수정에도 시트 upsert 1회)
 *   3. 어댑터로 엔티티 현재 스냅샷 read → 매핑필드 → content_hash
 *   4. 행식별(sync_row_id) 확보(기존 rowMap 또는 신규 발급) → 시트 upsert(append/update)
 *   5. rowMap.last_synced_hash = 방금 쓴 해시(에코루프 차단 기준) → outbox done → sync_log(ok)
 *
 * 재실행 안전: 시트 upsert 는 sync_row_id 로 append-or-update(멱등). 같은 pending 2회여도
 *   done 전이로 재조회 안 되고, 동일 (link,entity) 다중 pending 은 coalesce 로 1 upsert.
 */
import { contentHash } from './hash';
import { buildSheetRow, mappedFieldsForHash } from './column-map';
import type { EntityAdapter, OutboxRow, SheetLink } from './types';

/** 시트 API 추상 — 실 구현은 googleapis/REST, 테스트는 mock. */
export interface SheetsApi {
  /**
   * sync_row_id 기준 행 upsert. 존재하면 update, 없으면 append.
   * @returns upserted=true(정상). 예외는 throw(호출측이 failed 처리).
   */
  upsertRow(input: {
    link: SheetLink;
    syncRowId: string;
    /** 열문자 키 객체(buildSheetRow 결과) + _sync_id 는 syncIdColumn 에 기록. */
    cells: Record<string, string>;
  }): Promise<{ upserted: boolean }>;
}

/** outbox 워커가 쓰는 저장소 계약. */
export interface OutboxStore {
  /**
   * 처리할 outbox 를 원자적으로 claim(status=processing)해 반환 (C2: 크론 중첩 이중처리 차단).
   * pending/failed(attempts<3) + 스테일 processing 을 SKIP LOCKED 로 선점.
   */
  listPending(limit: number): Promise<OutboxRow[]>;
  /** link 정의 조회(캐시 가능). 비활성/미존재 → null. */
  getLink(linkId: string): Promise<SheetLink | null>;
  /**
   * (link,entity) 행식별을 get-or-create 하고 sync_row_id 반환 (C2: 최초 동기화 시 두 실행이
   * 같은 sync_row_id 를 보게 만들어 시트 중복 append 차단). 원자적(on conflict do nothing).
   */
  ensureRowMap(linkId: string, entityId: string): Promise<{ syncRowId: string }>;
  /** rowMap 의 last_synced_hash 갱신(sync_row_id 는 ensureRowMap 이 확정한 값 유지). */
  upsertRowMap(input: {
    linkId: string;
    entityId: string;
    syncRowId: string;
    lastSyncedHash: string;
  }): Promise<void>;
  markDone(outboxId: number): Promise<void>;
  markFailed(outboxId: number, error: string): Promise<void>;
  log(entry: {
    linkId: string;
    entityId: string | null;
    result: 'ok' | 'skipped_noop' | 'error';
    detail?: Record<string, unknown>;
  }): Promise<void>;
}

export interface OutboxDeps {
  store: OutboxStore;
  sheets: SheetsApi;
  /** entity 문자열 → 어댑터. */
  adapterFor(entity: string): EntityAdapter | null;
}

export interface OutboxSummary {
  processed: number; // upsert 시도한 (link,entity) 그룹 수
  upserted: number;
  skipped: number; // coalesce 로 접힌 superseded + noop
  failed: number;
}

/** 오래된순 유지하며 (link_id|entity_id) 최신(=최대 id)만 대표로. */
function coalesce(rows: OutboxRow[]): { primary: OutboxRow; superseded: OutboxRow[] }[] {
  const groups = new Map<string, OutboxRow[]>();
  for (const r of rows) {
    const key = `${r.linkId}|${r.entityId}`;
    const arr = groups.get(key);
    if (arr) arr.push(r);
    else groups.set(key, [r]);
  }
  const out: { primary: OutboxRow; superseded: OutboxRow[] }[] = [];
  for (const arr of groups.values()) {
    // 최대 id = 최신 enqueue = 대표. 나머지는 superseded. (arr 은 항상 1건 이상)
    const primary = arr.reduce((max, r) => (r.id > max.id ? r : max));
    const superseded = arr.filter((r) => r.id !== primary.id);
    out.push({ primary, superseded });
  }
  return out;
}

export async function processOutboxBatch(deps: OutboxDeps, limit = 100): Promise<OutboxSummary> {
  const { store, sheets, adapterFor } = deps;
  const rows = await store.listPending(limit);
  const summary: OutboxSummary = { processed: 0, upserted: 0, skipped: 0, failed: 0 };

  for (const { primary, superseded } of coalesce(rows)) {
    // superseded 는 시트 반영 없이 done (coalesce)
    for (const s of superseded) {
      await store.markDone(s.id);
      summary.skipped += 1;
    }

    summary.processed += 1;
    try {
      const link = await store.getLink(primary.linkId);
      if (!link || !link.active) {
        // 비활성/삭제된 링크 → noop done (재시도 무의미)
        await store.markDone(primary.id);
        await store.log({
          linkId: primary.linkId,
          entityId: primary.entityId,
          result: 'skipped_noop',
          detail: { reason: 'link_inactive_or_missing' },
        });
        summary.skipped += 1;
        continue;
      }

      const adapter = adapterFor(link.entity);
      if (!adapter) {
        await store.markFailed(primary.id, `no_adapter:${link.entity}`);
        summary.failed += 1;
        continue;
      }

      const entity = await adapter.read(primary.entityId);
      if (!entity) {
        // 엔티티 소멸 → 시트 반영 없이 noop(보관은 inbound 쪽 책임). 재시도 무의미.
        await store.markDone(primary.id);
        await store.log({
          linkId: link.id,
          entityId: primary.entityId,
          result: 'skipped_noop',
          detail: { reason: 'entity_gone' },
        });
        summary.skipped += 1;
        continue;
      }

      // C1: 웹훅과 동일 필드셋·정본화로 해시(에코 no-op 이 실제로 걸리게)
      const hash = contentHash(mappedFieldsForHash(entity.fields, link.columnMap));
      // C2: sync_row_id 를 DB 에서 원자적으로 확정(두 실행이 같은 행을 보게 → 중복 append 차단)
      const { syncRowId } = await store.ensureRowMap(link.id, primary.entityId);

      const cells = buildSheetRow(entity.fields, link.columnMap);
      // _sync_id 숨김열 동봉(시트에 행식별자 기록)
      cells[link.syncIdColumn] = syncRowId;

      await sheets.upsertRow({ link, syncRowId, cells });

      // last_synced_hash 갱신 → 이 쓰기가 onEdit 로 되돌아와도 에코 no-op
      await store.upsertRowMap({
        linkId: link.id,
        entityId: primary.entityId,
        syncRowId,
        lastSyncedHash: hash,
      });
      await store.markDone(primary.id);
      await store.log({
        linkId: link.id,
        entityId: primary.entityId,
        result: 'ok',
        detail: { syncRowId, hash },
      });
      summary.upserted += 1;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'outbox_upsert_failed';
      await store.markFailed(primary.id, message.slice(0, 500));
      await store.log({
        linkId: primary.linkId,
        entityId: primary.entityId,
        result: 'error',
        detail: { message: message.slice(0, 500) },
      });
      summary.failed += 1;
    }
  }

  return summary;
}
