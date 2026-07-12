/**
 * 입금확인 코어 로직 (server action 과 분리 → 단위 테스트 가능).
 *
 * 흐름: uuid 검증 → confirm_store_payment RPC → (성공) 구매자 payment_confirmed 알림 enqueue+flush
 *       best-effort. RPC 에러는 한국어 매핑(원문 미노출). 알림 실패는 입금확인 성공을 막지 않음.
 *
 * 멱등: RPC 자체가 status 조건부 UPDATE 로 멱등. 알림은 dedupe_key 'payment_confirmed:{id}'.
 */
import { isValidUuid } from './validation';
import { GENERIC_STORE_ERROR, mapStoreRpcError } from './errors';
import type { NotifyContext, NotifyFn, RpcCall } from './deps';

export interface StoreActionResult {
  ok: boolean;
  error?: string;
  status?: string;
  alreadyProcessed?: boolean;
}

export interface PaymentDeps {
  /** confirm_store_payment(p_order_id). */
  confirmPayment: RpcCall;
  /** 성공 후 알림 발송에 필요한 order_no·구매자 전화 로드. 실패 시 null(발송 skip). */
  loadNotifyContext: (orderId: string) => Promise<NotifyContext | null>;
  /** enqueue + flush best-effort. 절대 throw 하지 않는다. */
  notify: NotifyFn;
  /** 미매핑 RPC 에러 관측 훅(Sentry). */
  onUnknownError?: (message: string, context: Record<string, unknown>) => void;
}

export async function confirmStorePaymentCore(
  deps: PaymentDeps,
  orderId: string,
): Promise<StoreActionResult> {
  if (!isValidUuid(orderId)) {
    return { ok: false, error: '잘못된 주문 ID 입니다.' };
  }

  const { data, error } = await deps.confirmPayment({ p_order_id: orderId });
  if (error) {
    const mapped = mapStoreRpcError(error.message);
    if (!mapped.known) {
      deps.onUnknownError?.(error.message, { where: 'confirm_store_payment', orderId });
    }
    return { ok: false, error: mapped.message };
  }

  const result = (data ?? {}) as { status?: string; already_processed?: boolean };

  // 구매자 입금확인 알림 (best-effort · dedupe 로 재발송 방지)
  const ctx = await deps.loadNotifyContext(orderId);
  if (ctx) {
    await deps.notify({
      dedupeKey: `payment_confirmed:${orderId}`,
      orderId,
      template: 'payment_confirmed',
      toPhone: ctx.phone,
      variables: { order_no: ctx.orderNo },
    });
  }

  return {
    ok: true,
    status: result.status ?? 'paid',
    alreadyProcessed: result.already_processed === true,
  };
}

export { GENERIC_STORE_ERROR };
