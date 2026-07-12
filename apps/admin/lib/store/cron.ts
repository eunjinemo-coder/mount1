/**
 * 스토어 크론 틱 코어 (route 와 분리 → 단위 테스트 가능).
 *
 * 순서(재실행 안전):
 *   ② 리마인드 큐잉(rpc_store_enqueue_reminders) — reminder_sent_at 마커 + dedupe 로 1회만
 *   ③ 기한 경과 만료(rpc_store_expire_orders)      — status 조건부 UPDATE 로 멱등
 *   ① pending/failed(attempts<3) 재발송(flushPending) — dedupe/sent 전이로 중복발송 0
 *
 * 각 단계는 독립적으로 감싸 한 단계 실패가 다른 단계를 막지 않게 한다(부분 성공 허용).
 * ②③ 을 먼저 돌려 새 pending 을 만든 뒤 ① flush 로 이번 틱에 함께 발송한다.
 */
import type { FlushSummary } from '@mount/lib/notify';
import type { RpcCall } from './deps';

export interface CronStepError {
  step: 'reminders' | 'expire' | 'flush';
  message: string;
}

export interface CronResult {
  reminders: number;
  expired: number;
  flush: FlushSummary;
  errors: CronStepError[];
}

export interface CronDeps {
  /** rpc_store_enqueue_reminders() → { enqueued }. */
  enqueueReminders: RpcCall;
  /** rpc_store_expire_orders() → { expired }. */
  expireOrders: RpcCall;
  /** flushPending(store, sender) 바인딩. */
  flush: (limit?: number) => Promise<FlushSummary>;
  onUnknownError?: (message: string, context: Record<string, unknown>) => void;
}

const EMPTY_FLUSH: FlushSummary = { processed: 0, sent: 0, failed: 0 };

export async function storeCronTick(deps: CronDeps): Promise<CronResult> {
  const errors: CronStepError[] = [];

  // ② 리마인드 큐잉
  let reminders = 0;
  try {
    const { data, error } = await deps.enqueueReminders({});
    if (error) throw new Error(error.message);
    reminders = Number((data as { enqueued?: number } | null)?.enqueued ?? 0);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'reminders_failed';
    errors.push({ step: 'reminders', message });
    deps.onUnknownError?.(message, { where: 'cron.reminders' });
  }

  // ③ 기한 경과 만료
  let expired = 0;
  try {
    const { data, error } = await deps.expireOrders({});
    if (error) throw new Error(error.message);
    expired = Number((data as { expired?: number } | null)?.expired ?? 0);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'expire_failed';
    errors.push({ step: 'expire', message });
    deps.onUnknownError?.(message, { where: 'cron.expire' });
  }

  // ① 재발송 flush
  let flush: FlushSummary = EMPTY_FLUSH;
  try {
    flush = await deps.flush();
  } catch (e) {
    const message = e instanceof Error ? e.message : 'flush_failed';
    errors.push({ step: 'flush', message });
    deps.onUnknownError?.(message, { where: 'cron.flush' });
  }

  return { reminders, expired, flush, errors };
}
