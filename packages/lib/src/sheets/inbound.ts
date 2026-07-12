/**
 * 시트→앱 수신 코어 (§2.2 · §2.4). 순수 · DI. 정합성의 심장.
 *
 * 판정 순서(각 규약의 file:line 근거):
 *   1) 멱등(idempotency): (link, sync_row_id, content_hash) dedup insert 실패 → skipped_noop
 *   2) 에코루프(echo-loop): incoming hash == rowMap.last_synced_hash → skipped_noop
 *      (앱이 방금 쓴 값이 onEdit 로 되돌아온 것)
 *   3) 삭제(non-destructive): payload.deleted → adapter.archive (보관). 하드삭제 금지선.
 *   4) 형식검증: 이미 파싱된 fields 를 받되, 경고(warnings)가 있으면 앱 미반영 → error
 *      (호출측 웹훅이 시트 ⚠ 표기)
 *   5) 충돌(LWW): 기존 엔티티 있으면 resolveConflict. 시트 승 → 반영, 앱 승 → 미반영(conflict_app_won)
 *   6) 반영: adapter.applyInbound → rowMap.last_synced_hash = incoming hash (다음 앱→시트 에코 차단)
 */
import { resolveConflict, DEFAULT_CONFLICT_WINDOW_SEC } from './conflict';
import type { EntityAdapter, MappedRow, SyncResult } from './types';

/** 웹훅/폴링이 이미 서명검증·파싱을 끝내고 넘기는 정규 페이로드. */
export interface InboundPayload {
  readonly linkId: string;
  readonly syncRowId: string;
  /** 파싱된 매핑필드(형식검증 통과분). */
  readonly fields: MappedRow;
  /** 서버 재계산한 content_hash(fields 기준). */
  readonly contentHash: string;
  /** 시트 편집시각(ISO). LWW 비교 기준. */
  readonly sheetUpdatedAt: string | null;
  /** 행 삭제 신호. true → 보관(archive). */
  readonly deleted?: boolean;
  /** parseSheetRow 형식경고 존재 여부(호출측이 검증 후 세팅). true → 반영 안 함. */
  readonly hasFormatWarnings?: boolean;
}

export interface InboundStore {
  /**
   * (link, sync_row_id, content_hash) dedup 키 삽입. 이미 있으면 inserted=false.
   * → 멱등: 같은 변경 중복 수신 시 1회만 처리.
   */
  dedupInsert(linkId: string, syncRowId: string, contentHash: string): Promise<{ inserted: boolean }>;
  /** sync_row_id 로 기존 행식별 조회. 없으면 null(신규 행). */
  getRowMapBySyncRow(
    linkId: string,
    syncRowId: string,
  ): Promise<{ entityId: string; lastSyncedHash: string | null; archivedAt: string | null } | null>;
  /** last_synced_hash 갱신(반영 후 에코 차단). rowMap 없으면 entityId 로 생성. */
  setRowMap(input: {
    linkId: string;
    entityId: string;
    syncRowId: string;
    lastSyncedHash: string;
  }): Promise<void>;
  /** 보관 마킹(archive). */
  markArchived(linkId: string, syncRowId: string): Promise<void>;
  log(entry: {
    linkId: string;
    entityId: string | null;
    result: SyncResult;
    detail?: Record<string, unknown>;
  }): Promise<void>;
}

export interface InboundDeps {
  store: InboundStore;
  adapter: EntityAdapter;
  conflictWindowSec?: number;
}

export interface InboundOutcome {
  readonly result: SyncResult;
  readonly entityId: string | null;
  /** 호출측 웹훅이 시트 상태열에 표기할 힌트. */
  readonly writeBack?: 'ok' | 'warn' | 'conflict' | 'archived';
}

export async function processInboundRow(
  deps: InboundDeps,
  payload: InboundPayload,
): Promise<InboundOutcome> {
  const { store, adapter } = deps;
  const window = deps.conflictWindowSec ?? DEFAULT_CONFLICT_WINDOW_SEC;
  const { linkId, syncRowId, contentHash: hash } = payload;

  const existing = await store.getRowMapBySyncRow(linkId, syncRowId);

  // ── 3) 삭제: 비파괴 보관 (dedup/에코 판정보다 먼저 — 삭제는 값비교 대상 아님) ──
  if (payload.deleted) {
    if (existing && !existing.archivedAt) {
      await store.markArchived(linkId, syncRowId);
      await adapter.archive(existing.entityId);
      await store.log({
        linkId,
        entityId: existing.entityId,
        result: 'ok',
        detail: { action: 'archived' },
      });
      return { result: 'ok', entityId: existing.entityId, writeBack: 'archived' };
    }
    // 매핑 없음/이미 보관 → noop
    await store.log({ linkId, entityId: existing?.entityId ?? null, result: 'skipped_noop', detail: { action: 'delete_noop' } });
    return { result: 'skipped_noop', entityId: existing?.entityId ?? null };
  }

  // ── 2) 에코루프: 앱이 방금 쓴 값이 되돌아옴 → no-op ──
  //   (dedup 보다 먼저 — 에코는 dedup 키를 소모하지 않고 즉시 무시하는 게 자연스럽다)
  if (existing && existing.lastSyncedHash !== null && existing.lastSyncedHash === hash) {
    await store.log({
      linkId,
      entityId: existing.entityId,
      result: 'skipped_noop',
      detail: { reason: 'echo_loop' },
    });
    return { result: 'skipped_noop', entityId: existing.entityId };
  }

  // ── 1) 멱등: 같은 변경 중복 수신 차단 ──
  const dedup = await store.dedupInsert(linkId, syncRowId, hash);
  if (!dedup.inserted) {
    await store.log({
      linkId,
      entityId: existing?.entityId ?? null,
      result: 'skipped_noop',
      detail: { reason: 'duplicate' },
    });
    return { result: 'skipped_noop', entityId: existing?.entityId ?? null };
  }

  // ── 4) 형식검증 실패 → 앱 미반영(오염방지) + ⚠ 표기 힌트 ──
  if (payload.hasFormatWarnings) {
    await store.log({
      linkId,
      entityId: existing?.entityId ?? null,
      result: 'error',
      detail: { reason: 'format_warning' },
    });
    return { result: 'error', entityId: existing?.entityId ?? null, writeBack: 'warn' };
  }

  // ── 5) 충돌(LWW) — 기존 엔티티가 있을 때만 비교 ──
  if (existing) {
    const current = await adapter.read(existing.entityId);
    const appUpdatedAt = current?.updatedAt ?? null;
    const decision = resolveConflict(payload.sheetUpdatedAt, appUpdatedAt, window);

    if (decision.winner === 'app') {
      // 앱이 확실히 최신 → 시트 미반영(비파괴). conflict 기록.
      await store.log({
        linkId,
        entityId: existing.entityId,
        result: 'conflict_app_won',
        detail: { sheetUpdatedAt: payload.sheetUpdatedAt, appUpdatedAt },
      });
      return { result: 'conflict_app_won', entityId: existing.entityId, writeBack: 'conflict' };
    }

    // 시트 승 → 반영
    const applied = await adapter.applyInbound({ entityId: existing.entityId, fields: payload.fields });
    if (!applied.applied) {
      // D1: 반영 실패(대상 부재/DB오류) → 조용한 ok 금지. last_synced_hash 갱신 안 함(재시도 여지).
      await store.log({
        linkId,
        entityId: existing.entityId,
        result: 'error',
        detail: { reason: applied.reason ?? 'apply_failed' },
      });
      return { result: 'error', entityId: existing.entityId, writeBack: 'warn' };
    }
    await store.setRowMap({
      linkId,
      entityId: existing.entityId,
      syncRowId,
      lastSyncedHash: hash,
    });
    const result: SyncResult = decision.simultaneous ? 'conflict_sheet_won' : 'ok';
    await store.log({
      linkId,
      entityId: existing.entityId,
      result,
      detail: { applied: applied.applied, simultaneous: decision.simultaneous },
    });
    return {
      result,
      entityId: existing.entityId,
      writeBack: decision.simultaneous ? 'conflict' : 'ok',
    };
  }

  // ── 6) 신규 시트행 → 앱 엔티티 생성 시도 ──
  const created = await adapter.applyInbound({ entityId: null, fields: payload.fields });
  if (!created.applied || !created.entityId) {
    // 생성 미지원/불가(예: 필수 PII 부재) → 반영 안 함(비파괴). error 기록.
    await store.log({
      linkId,
      entityId: null,
      result: 'error',
      detail: { reason: created.reason ?? 'create_unsupported' },
    });
    return { result: 'error', entityId: null, writeBack: 'warn' };
  }
  await store.setRowMap({
    linkId,
    entityId: created.entityId,
    syncRowId,
    lastSyncedHash: hash,
  });
  await store.log({ linkId, entityId: created.entityId, result: 'ok', detail: { created: true } });
  return { result: 'ok', entityId: created.entityId, writeBack: 'ok' };
}
