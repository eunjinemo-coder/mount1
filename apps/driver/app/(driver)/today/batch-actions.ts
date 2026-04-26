'use server';

import { callRpc, getServerClient } from '@mount/db';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface BatchResult {
  ok: boolean;
  successCount?: number;
  failCount?: number;
  errors?: string[];
}

/**
 * 선택한 주문들에 대해 manual_marked_done 통화 기록 일괄 INSERT.
 * 현장에서 통화 후 시간이 없어 즉시 기록 못한 케이스 — 하루 끝에 몰아서 정리.
 */
export async function batchMarkCallsAction(orderIds: string[]): Promise<BatchResult> {
  const validIds = orderIds.filter((id) => UUID_RE.test(id));
  if (validIds.length === 0) {
    return { ok: false, errors: ['유효한 주문이 없어요.'] };
  }

  const client = await getServerClient();
  const errors: string[] = [];
  let successCount = 0;

  for (const id of validIds) {
    const { error } = await callRpc<{ ok: boolean }>(client, 'rpc_technician_log_call', {
      p_order_id: id,
      p_type: 'pre_arrival_30min',
      p_outcome: 'manual_marked_done',
      p_duration_seconds: null,
    });

    if (error) {
      errors.push(`${id.slice(0, 8)}: ${error.message ?? '실패'}`);
    } else {
      successCount += 1;
    }
  }

  return {
    ok: successCount > 0,
    successCount,
    failCount: validIds.length - successCount,
    errors: errors.length > 0 ? errors : undefined,
  };
}
