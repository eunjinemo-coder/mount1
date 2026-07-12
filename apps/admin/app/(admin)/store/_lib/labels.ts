/**
 * store 어드민 화면(A1~A4) 공용 — 라벨맵 · 포맷터 · 역할 상수.
 * 순수 데이터/함수만 담는다 — client 컴포넌트에서도 import 하므로 서버 전용 코드는
 * DB 접근 헬퍼(storeClient/safeSelect 등)가 있는 ./shared 로 분리한다.
 */
export const STORE_OPS_ROLES = ['super_admin', 'ops_admin'] as const;
export const STORE_QUOTE_ROLES = ['super_admin', 'ops_admin', 'cs_admin'] as const;

export const PRODUCT_STATUS_LABEL: Record<string, string> = {
  draft: '초안',
  published: '공개',
  hidden: '숨김',
};

export const ORDER_STATUS_LABEL: Record<string, string> = {
  awaiting_payment: '입금대기',
  paid: '결제완료',
  preparing: '배송준비',
  shipped: '배송중',
  delivered: '배송완료',
  cancelled: '취소',
  expired: '기한만료',
};

export const CARRIER_LABEL: Record<string, string> = {
  cj: 'CJ대한통운',
  lotte: '롯데택배',
  hanjin: '한진택배',
  logen: '로젠택배',
  post: '우체국택배',
};

export const QUOTE_STATUS_LABEL: Record<string, string> = {
  new: '신규',
  contacted: '연락완료',
  closed: '종료',
};

export const CURRENCY = new Intl.NumberFormat('ko-KR');

export const DATETIME = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Seoul',
});

export function formatDateTime(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return DATETIME.format(d);
}

export function formatWon(amount: number | null | undefined): string {
  return `${CURRENCY.format(amount ?? 0)}원`;
}
