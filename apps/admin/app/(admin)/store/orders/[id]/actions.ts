'use server';

/**
 * A3 주문 상세 전용 — 구매자 연락처 조회 server action.
 *
 * rpc_admin_get_store_buyer_phone(0021) 은 SECURITY DEFINER + audit_events 기록.
 * "표시" 버튼을 눌렀을 때만 호출한다(기본은 buyer_phone_tail4 마스킹 표시) — PRD §7 /
 * 팀리드 지시대로 PII 는 명시적 조회로만 노출.
 */
import { callRpc, getServerClient } from '@mount/db';
import { assertAdminRole, isValidUuid } from '@mount/lib';
import { STORE_OPS_ROLES } from '../../_lib/labels';

export interface RevealBuyerPhoneResult {
  ok: boolean;
  phone?: string;
  error?: string;
}

export async function revealBuyerPhoneAction(orderId: string): Promise<RevealBuyerPhoneResult> {
  await assertAdminRole(STORE_OPS_ROLES);

  if (!isValidUuid(orderId)) {
    return { ok: false, error: '잘못된 주문 ID 입니다.' };
  }

  const client = await getServerClient();
  const { data, error } = await callRpc(client, 'rpc_admin_get_store_buyer_phone', {
    p_order_id: orderId,
  });

  if (error) return { ok: false, error: '연락처 조회에 실패했습니다.' };

  const phone = (data as { phone?: string } | null)?.phone;
  if (!phone) return { ok: false, error: '연락처를 찾을 수 없습니다.' };

  return { ok: true, phone };
}
