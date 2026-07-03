/**
 * 발송 큐 오케스트레이션 — enqueue(멱등) / flush(발송+상태갱신) / flushPending(크론).
 *
 * DB·발송을 MessageStore·Sender 로 주입받는 순수 로직 → 크론 재실행 안전성을 단위테스트로 검증.
 * 멱등성은 두 겹:
 *   · enqueue: dedupe_key unique(insertPending 이 충돌 시 no-op)
 *   · flush:   status 를 sent 로 옮기고, listRetryable 은 pending/failed(attempts<3)만 반환
 *              → 이미 sent 된 행은 재조회되지 않아 크론 2회 실행에도 발송 1회.
 */
import type { EnqueueParams, MessageRow, MessageStore, SendResult, Sender } from './types';

export async function enqueueMessage(
  store: MessageStore,
  params: EnqueueParams,
): Promise<{ inserted: boolean }> {
  return store.insertPending(params);
}

/** 한 행 발송 + 결과에 따라 sent/failed 갱신. */
export async function flushMessage(
  store: MessageStore,
  sender: Sender,
  row: MessageRow,
): Promise<SendResult> {
  const result = await sender.send(row);
  if (result.ok) {
    await store.markSent(row.id, result.channel, result.providerMessageId);
  } else {
    await store.markFailed(row.id, result.error ?? 'unknown');
  }
  return result;
}

export interface FlushSummary {
  processed: number;
  sent: number;
  failed: number;
}

/** 재발송 대상 일괄 flush(크론 ①). limit 로 배치 상한. */
export async function flushPending(
  store: MessageStore,
  sender: Sender,
  limit = 50,
): Promise<FlushSummary> {
  const rows = await store.listRetryable(limit);
  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    const r = await flushMessage(store, sender, row);
    if (r.ok) sent += 1;
    else failed += 1;
  }
  return { processed: rows.length, sent, failed };
}
