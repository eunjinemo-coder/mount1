import 'server-only';

/**
 * 시트 동기화 크론 틱 — 기존 /api/cron(15분)에서 스토어 틱과 함께 호출.
 *
 *   1) outbox 워커(앱→시트): processOutboxBatch — 완전 구현(재실행 안전).
 *   2) 폴링 백업(시트→앱): 트리거(onEdit 웹훅) 유실 대비 스냅샷 diff.
 *
 * 서비스계정 미설정 시 outbox 는 조용히 skip(sheets 클라 생성 throw) → 동기화만 멈추고
 * 스토어 크론/앱은 정상. 각 단계 독립 try 로 부분성공 허용.
 *
 * ── 폴링 백업 구현 상태(부분/TODO) ──────────────────────────────────────────
 *   pollInboundBackup 은 활성 링크를 훑어 "전체 시트 스냅샷 diff → 변경행을 웹훅과 동일
 *   경로(processInboundRow)로 반영"하는 코어 골격만 둔다. 시트 전체 read + 직전 스냅샷
 *   저장/비교(해시 기준)는 sheet_links.last_polled_at + 별도 스냅샷 스토어가 필요해 이번
 *   패스는 링크 열거 + 훅 지점까지만 구현하고 실제 diff 는 TODO 로 명시한다. 웹훅이 주 경로,
 *   폴링은 유실 대비 안전망이므로 초기 운영은 웹훅으로 충분(§2.1).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { processOutboxBatch, type OutboxSummary } from '@mount/lib/sheets';
import { makeOutboxDeps } from './deps';
import { createSheetSyncStore } from './store';

const GC_RETENTION_DAYS = 30;

export interface SheetsCronResult {
  outbox: OutboxSummary | null;
  polledLinks: number;
  gc: boolean;
  errors: { step: 'outbox' | 'poll' | 'gc'; message: string }[];
}

export async function sheetsCronTick(serviceClient: SupabaseClient): Promise<SheetsCronResult> {
  const errors: SheetsCronResult['errors'] = [];

  // 1) outbox 워커 (앱→시트)
  let outbox: OutboxSummary | null = null;
  try {
    outbox = await processOutboxBatch(makeOutboxDeps(serviceClient));
  } catch (e) {
    // 서비스계정 미설정 등 → 동기화만 skip
    errors.push({ step: 'outbox', message: e instanceof Error ? e.message : 'outbox_failed' });
  }

  // 2) 폴링 백업 (시트→앱) — 골격만(TODO: 스냅샷 diff)
  let polledLinks = 0;
  try {
    polledLinks = await pollInboundBackup(serviceClient);
  } catch (e) {
    errors.push({ step: 'poll', message: e instanceof Error ? e.message : 'poll_failed' });
  }

  // 3) GC — 오래된 dedup/로그/done outbox 정리(무한 성장 방지). 실패해도 동기화엔 무해.
  let gc = false;
  try {
    await createSheetSyncStore(serviceClient).gcOldRows(GC_RETENTION_DAYS);
    gc = true;
  } catch (e) {
    errors.push({ step: 'gc', message: e instanceof Error ? e.message : 'gc_failed' });
  }

  return { outbox, polledLinks, gc, errors };
}

/**
 * 폴링 백업 코어 골격. 현재는 활성 링크 수만 반환(웹훅이 주 경로).
 * TODO(폴링 완성): 링크별 전체 시트 read → 행별 content_hash 계산 → 직전 스냅샷과 diff →
 *   변경/신규/삭제행을 processInboundRow(makeInboundDeps) 로 반영 → last_polled_at 갱신.
 */
async function pollInboundBackup(serviceClient: SupabaseClient): Promise<number> {
  const store = createSheetSyncStore(serviceClient);
  const links = await store.activeLinksForEntity('installation');
  // 실제 diff 반영은 미구현(TODO). 링크 열거까지만.
  return links.length;
}
