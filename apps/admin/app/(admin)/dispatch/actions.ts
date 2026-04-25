'use server';

import { callRpc, getServerClient } from '@mount/db';

export interface AssignResult {
  ok: boolean;
  error?: string;
}

export async function assignOrderAction(
  orderId: string,
  technicianId: string,
  overrideReason?: string,
): Promise<AssignResult> {
  if (!orderId || !technicianId) {
    return { ok: false, error: '주문과 기사를 모두 선택해 주세요.' };
  }

  const client = await getServerClient();
  const { error } = await callRpc<{ ok: boolean }>(client, 'rpc_admin_dispatch', {
    p_order_id: orderId,
    p_technician_id: technicianId,
    p_override_reason: overrideReason ?? null,
  });

  if (error) {
    const msg = error.message || '';
    if (msg.includes('technician_inactive')) {
      return { ok: false, error: '선택한 기사가 비활성 상태입니다.' };
    }
    if (msg.includes('invalid_from_status')) {
      return { ok: false, error: '현재 주문 상태에서는 배차할 수 없어요.' };
    }
    if (msg.includes('unauthorized')) {
      return { ok: false, error: '배차 권한이 없습니다.' };
    }
    return { ok: false, error: '배차에 실패했어요. 다시 시도해 주세요.' };
  }

  return { ok: true };
}
