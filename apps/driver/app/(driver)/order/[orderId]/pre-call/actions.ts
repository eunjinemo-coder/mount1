'use server';

import { callRpc, getServerClient } from '@mount/db';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CallOutcome =
  | 'answered'
  | 'no_answer'
  | 'busy'
  | 'unreachable'
  | 'manual_marked_done'
  | 'customer_postponed'
  | 'customer_cancelled';

export interface LogCallResult {
  ok: boolean;
  error?: string;
}

export async function logPreCallAction(args: {
  orderId: string;
  outcome: CallOutcome;
  durationSeconds?: number;
}): Promise<LogCallResult> {
  if (!UUID_RE.test(args.orderId)) {
    return { ok: false, error: '잘못된 주문 ID입니다.' };
  }

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

export interface GetPhoneResult {
  ok: boolean;
  phone?: string;
  error?: string;
}

/** 전화 걸기 직전 일회성 복호화 — 응답은 클라가 저장하지 않고 바로 tel: 딥링크로 소비. */
export async function getCustomerPhoneAction(orderId: string): Promise<GetPhoneResult> {
  if (!UUID_RE.test(orderId)) {
    return { ok: false, error: '잘못된 주문 ID입니다.' };
  }

  const client = await getServerClient();
  const { data, error } = await callRpc<{ ok: boolean; phone: string }>(
    client,
    'rpc_technician_get_customer_phone',
    { p_order_id: orderId },
  );

  if (error) {
    const msg = error.message || '';
    if (msg.includes('not_your_order')) {
      return { ok: false, error: '본인 배차건이 아닙니다.' };
    }
    if (msg.includes('phone_missing')) {
      return { ok: false, error: '고객 전화번호가 등록되어 있지 않아요.' };
    }
    if (msg.includes('pii_key_missing')) {
      return { ok: false, error: '서버 키 미설정 — 본사에 문의해 주세요.' };
    }
    return { ok: false, error: '전화번호 조회에 실패했어요.' };
  }

  if (!data?.phone) {
    return { ok: false, error: '전화번호를 가져오지 못했어요.' };
  }

  return { ok: true, phone: data.phone };
}
