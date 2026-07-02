/**
 * 수량 구간 단가 계산 — 클라이언트 총액 표시용.
 *
 * ⚠️ 표시 전용이다. 결제 총액의 진실 원천은 create_store_order RPC 의 서버 재계산이며
 *   (0021_store.sql), 이 함수는 그 로직을 그대로 미러해 UI 에서 동일 값을 보여줄 뿐이다.
 *   클라이언트 계산값은 절대 서버로 신뢰 전달되지 않는다.
 */

export interface PriceTier {
  minQty: number;
  unitPrice: number;
}

/**
 * qty 에 적용될 단가를 구한다.
 *   min_qty <= qty 인 tier 중 min_qty 가 가장 큰 것의 unit_price, 없으면 basePrice.
 * (create_store_order 의 `order by min_qty desc limit 1` 와 동일)
 */
export function resolveUnitPrice(basePrice: number, tiers: PriceTier[], qty: number): number {
  let best = basePrice;
  let bestMin = 0;
  for (const tier of tiers) {
    if (tier.minQty <= qty && tier.minQty > bestMin) {
      bestMin = tier.minQty;
      best = tier.unitPrice;
    }
  }
  return best;
}

/** 라인 소계 = 적용단가 × 수량. */
export function calcLineSubtotal(basePrice: number, tiers: PriceTier[], qty: number): number {
  return resolveUnitPrice(basePrice, tiers, qty) * qty;
}

/** 개당 절감액 = 1개 기준가 − 적용단가 (음수 방지). */
export function calcUnitSavings(basePrice: number, unitPrice: number): number {
  return Math.max(0, basePrice - unitPrice);
}

/** 총 절감액 = (1개 기준가 − 적용단가) × 수량. */
export function calcTotalSavings(basePrice: number, unitPrice: number, qty: number): number {
  return Math.max(0, (basePrice - unitPrice) * qty);
}
