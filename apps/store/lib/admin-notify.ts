/**
 * 신규주문 admin 알림 큐잉 (best-effort).
 *
 * 정책(은진님 2026-07-03 · SMS 비용폭탄 방지): 주문 생성(anon) 시점엔 은진님(고정 발신대상)
 * 에게만 신규주문 알림을 큐잉한다. 구매자 대상 발송은 입금확인/발송 이후(admin 트리거)에만.
 *
 * anon 은 order_no 만 넘긴다 — 수신번호/템플릿은 DB RPC(enqueue_store_admin_new_order)가
 * 서버에서 고정한다(anon 이 수신번호를 조종하는 발송 경로를 만들지 않는다). Solapi 시크릿은
 * 이 앱(store, anon)에 두지 않고 admin 크론이 큐를 flush 한다.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { callRpc } from '@mount/db';
import { captureMessage } from '@mount/lib';

export async function enqueueAdminNewOrder(
  client: SupabaseClient,
  orderNo: string,
): Promise<void> {
  try {
    const { error } = await callRpc(client, 'enqueue_store_admin_new_order', {
      p_order_no: orderNo,
    });
    if (error) {
      captureMessage('enqueue_store_admin_new_order 실패', 'warning', { where: 'store_order' });
    }
  } catch {
    // best-effort — 주문 자체는 성공. 알림 큐잉 실패는 주문 흐름을 막지 않는다.
  }
}
