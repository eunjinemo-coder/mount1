'use server';

/**
 * 스토어 운영 server actions (A3 입금확인 · A2/A3 운송장 등록).
 *
 * 얇은 어댑터: 권한(assertAdminRole) + supabase 유저 클라이언트 + notify 어댑터를
 * payment/shipment 코어에 주입. 핵심 로직·에러매핑은 lib/store/*.ts 에 있다.
 *
 * R4b(admin UI)는 이 두 액션을 import 해 A2/A3 화면 버튼에 연결한다:
 *   confirmStorePaymentAction(orderId)
 *   registerStoreShipmentAction(orderId, carrier, trackingNo)
 */
import { revalidatePath } from 'next/cache';
import { getServerClient } from '@mount/db';
import { assertAdminRole, captureMessage } from '@mount/lib';
import { confirmStorePaymentCore, type StoreActionResult } from '@/lib/store/payment';
import { registerStoreShipmentCore } from '@/lib/store/shipment';
import { bindRpc, makeLoadNotifyContext, makeNotify } from '@/lib/store/notify-adapter';

const STORE_OPS_ROLES = ['super_admin', 'ops_admin'] as const;

function revalidateStoreOrder(orderId: string): void {
  revalidatePath('/store/orders');
  revalidatePath(`/store/orders/${orderId}`);
}

export async function confirmStorePaymentAction(orderId: string): Promise<StoreActionResult> {
  await assertAdminRole(STORE_OPS_ROLES);
  const client = await getServerClient();

  const result = await confirmStorePaymentCore(
    {
      confirmPayment: bindRpc(client, 'confirm_store_payment'),
      loadNotifyContext: makeLoadNotifyContext(client),
      notify: makeNotify(client),
      onUnknownError: (message, context) =>
        captureMessage(`confirm_store_payment 미매핑 에러: ${message}`, 'error', context),
    },
    orderId,
  );

  if (result.ok) revalidateStoreOrder(orderId);
  return result;
}

export async function registerStoreShipmentAction(
  orderId: string,
  carrier: string,
  trackingNo: string,
): Promise<StoreActionResult> {
  await assertAdminRole(STORE_OPS_ROLES);
  const client = await getServerClient();

  const result = await registerStoreShipmentCore(
    {
      registerShipment: bindRpc(client, 'register_store_shipment'),
      loadNotifyContext: makeLoadNotifyContext(client),
      notify: makeNotify(client),
      onUnknownError: (message, context) =>
        captureMessage(`register_store_shipment 미매핑 에러: ${message}`, 'error', context),
    },
    { orderId, carrier, trackingNo },
  );

  if (result.ok) revalidateStoreOrder(orderId);
  return result;
}
