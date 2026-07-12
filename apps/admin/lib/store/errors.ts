/**
 * store 운영 RPC 에러 토큰 → 한국어 매핑. 원문 SQLSTATE/영문 토큰을 UI 에 노출하지 않는다.
 *
 * 토큰 출처:
 *   confirm_store_payment          — unauthorized · order_not_found · insufficient_stock_at_confirm
 *   register_store_shipment        — unauthorized · invalid_carrier · tracking_no_required
 *                                    · tracking_no_too_long · order_not_found · order_not_paid
 *   rpc_admin_get_store_buyer_phone— unauthorized · order_not_found
 */

const KOREAN: Record<string, string> = {
  unauthorized: '권한이 없습니다. 관리자 계정으로 다시 시도해 주세요.',
  order_not_found: '주문을 찾을 수 없습니다.',
  insufficient_stock_at_confirm:
    '재고가 부족하여 입금확인을 완료할 수 없습니다. 재고를 확인한 뒤 다시 시도해 주세요.',
  invalid_carrier: '택배사를 선택해 주세요.',
  tracking_no_required: '운송장 번호를 입력해 주세요.',
  tracking_no_too_long: '운송장 번호가 너무 깁니다. 다시 확인해 주세요.',
  order_not_paid: '입금확인(결제완료) 상태의 주문만 운송장을 등록할 수 있습니다.',
};

export const GENERIC_STORE_ERROR = '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';

/**
 * RPC 에러 메시지 → { message(한국어), known }.
 * Postgres raise 메시지에 토큰이 포함(예: "order_not_paid" · "insufficient_stock_at_confirm ...").
 */
export function mapStoreRpcError(message: string): { message: string; known: boolean } {
  for (const token of Object.keys(KOREAN)) {
    if (message.includes(token)) {
      return { message: KOREAN[token]!, known: true };
    }
  }
  return { message: GENERIC_STORE_ERROR, known: false };
}
