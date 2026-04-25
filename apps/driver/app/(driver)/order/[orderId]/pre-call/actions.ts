'use server';

import { callRpc, getServerClient } from '@mount/db';

export type CallOutcome =
  | 'answered'
  | 'no_answer'
  | 'busy'
  | 'unreachable'
  | 'manual_marked_done';

export interface LogCallResult {
  ok: boolean;
  error?: string;
}

export async function logPreCallAction(args: {
  orderId: string;
  outcome: CallOutcome;
  durationSeconds?: number;
}): Promise<LogCallResult> {
  const client = await getServerClient();
  const { error } = await callRpc<{ ok: boolean }>(client, 'rpc_technician_log_call', {
    p_order_id: args.orderId,
    p_type: 'pre_arrival_30min',
    p_outcome: args.outcome,
    p_duration_seconds: args.durationSeconds ?? null,
  });

  if (error) {
    const msg = error.message || '';
    if (msg.includes('not_your_order')) {
      return { ok: false, error: '본인 배차건이 아닙니다.' };
    }
    if (msg.includes('invalid_call_outcome')) {
      return { ok: false, error: '통화 결과 값이 올바르지 않습니다.' };
    }
    return { ok: false, error: '통화 기록 저장에 실패했어요.' };
  }

  return { ok: true };
}
