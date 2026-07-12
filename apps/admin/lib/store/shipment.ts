/**
 * 운송장 등록 코어 로직 (server action 과 분리 → 단위 테스트 가능).
 *
 * 흐름: 입력검증(uuid·carrier·tracking) → register_store_shipment RPC →
 *       (성공) 구매자 shipped 알림 enqueue+flush best-effort.
 * RPC 에러는 한국어 매핑. 알림 실패는 등록 성공을 막지 않음.
 */
import { isValidUuid } from './validation';
import { mapStoreRpcError } from './errors';
import type { NotifyContext, NotifyFn, RpcCall } from './deps';
import type { StoreActionResult } from './payment';

/** 0021 store_shipments.carrier CHECK 와 동일. */
export const CARRIER_CODES = ['cj', 'lotte', 'hanjin', 'logen', 'post'] as const;
export type CarrierCode = (typeof CARRIER_CODES)[number];

export interface ShipmentInput {
  orderId: string;
  carrier: string;
  trackingNo: string;
}

export interface ShipmentDeps {
  /** register_store_shipment(p_order_id, p_carrier, p_tracking_no). */
  registerShipment: RpcCall;
  loadNotifyContext: (orderId: string) => Promise<NotifyContext | null>;
  notify: NotifyFn;
  onUnknownError?: (message: string, context: Record<string, unknown>) => void;
}

export async function registerStoreShipmentCore(
  deps: ShipmentDeps,
  input: ShipmentInput,
): Promise<StoreActionResult> {
  if (!isValidUuid(input.orderId)) {
    return { ok: false, error: '잘못된 주문 ID 입니다.' };
  }
  if (!CARRIER_CODES.includes(input.carrier as CarrierCode)) {
    return { ok: false, error: '택배사를 선택해 주세요.' };
  }
  const trackingNo = (input.trackingNo ?? '').replace(/\s/g, '');
  if (trackingNo.length === 0) {
    return { ok: false, error: '운송장 번호를 입력해 주세요.' };
  }

  const { error } = await deps.registerShipment({
    p_order_id: input.orderId,
    p_carrier: input.carrier,
    p_tracking_no: trackingNo,
  });
  if (error) {
    const mapped = mapStoreRpcError(error.message);
    if (!mapped.known) {
      deps.onUnknownError?.(error.message, { where: 'register_store_shipment', orderId: input.orderId });
    }
    return { ok: false, error: mapped.message };
  }

  // 구매자 발송 알림 (best-effort · dedupe 'shipped:{id}')
  const ctx = await deps.loadNotifyContext(input.orderId);
  if (ctx) {
    await deps.notify({
      dedupeKey: `shipped:${input.orderId}`,
      orderId: input.orderId,
      template: 'shipped',
      toPhone: ctx.phone,
      variables: {
        order_no: ctx.orderNo,
        carrier: input.carrier,
        tracking_no: trackingNo,
      },
    });
  }

  return { ok: true, status: 'shipped' };
}
