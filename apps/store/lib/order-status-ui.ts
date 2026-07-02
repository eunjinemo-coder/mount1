/**
 * 주문 상태 → S5 타임라인 표시 모델.
 *
 * status 원천: 0021_store.sql store_orders.status CHECK
 *   'awaiting_payment' | 'paid' | 'preparing' | 'shipped' | 'delivered'
 *   | 'cancelled' | 'expired'
 *
 * 정상 흐름은 5단계 타임라인, cancelled/expired 는 별도 종결 상태로 표시한다.
 */
export type OrderStatus =
  | 'awaiting_payment'
  | 'paid'
  | 'preparing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'expired';

export interface TimelineStep {
  key: OrderStatus;
  label: string;
  /** 구매자 관점 한줄 설명 */
  desc: string;
}

/** 정상 진행 5단계 (입금대기 → 입금확인 → 배송준비 → 배송중 → 완료) */
export const TIMELINE_STEPS: TimelineStep[] = [
  { key: 'awaiting_payment', label: '입금대기', desc: '입금을 기다리고 있어요' },
  { key: 'paid', label: '입금확인', desc: '입금이 확인됐어요' },
  { key: 'preparing', label: '배송준비', desc: '상품을 포장하고 있어요' },
  { key: 'shipped', label: '배송중', desc: '택배로 발송됐어요' },
  { key: 'delivered', label: '완료', desc: '배송이 완료됐어요' },
];

export interface StatusView {
  /** 정상 타임라인이면 현재 단계 index(0~4), 종결(취소/만료)이면 -1 */
  activeIndex: number;
  /** 종결 상태 여부 */
  terminal: boolean;
  /** 종결 상태 라벨·설명 (terminal 일 때만) */
  terminalLabel?: string;
  terminalDesc?: string;
  tone: 'progress' | 'cancelled' | 'expired';
}

const TERMINAL: Record<'cancelled' | 'expired', { label: string; desc: string }> = {
  cancelled: { label: '주문 취소', desc: '이 주문은 취소되었습니다.' },
  expired: { label: '기한 만료', desc: '입금 기한이 지나 주문이 만료되었습니다.' },
};

export function resolveStatusView(status: string): StatusView {
  if (status === 'cancelled' || status === 'expired') {
    return {
      activeIndex: -1,
      terminal: true,
      terminalLabel: TERMINAL[status].label,
      terminalDesc: TERMINAL[status].desc,
      tone: status,
    };
  }
  const idx = TIMELINE_STEPS.findIndex((s) => s.key === status);
  return {
    activeIndex: idx < 0 ? 0 : idx,
    terminal: false,
    tone: 'progress',
  };
}
