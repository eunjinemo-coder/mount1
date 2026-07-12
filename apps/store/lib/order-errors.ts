/**
 * RPC 오류 → 사용자 노출 한국어 필드/전역 에러 매핑.
 *
 * 0021_store.sql 의 create_store_order 는 에러를 두 형태로 raise 한다:
 *   · 영문 토큰      : 'invalid_phone', 'items_required', 'variant_not_found' 등
 *   · 한국어 문장    : '주문 항목이 너무 많습니다(최대 50종).' 등 (FIX-3/4 신규 검증)
 * supabase-js 는 이 message 를 PostgrestError.message 로 그대로 전달한다.
 * 두 형태 모두 매핑하고, 미지의 message 는 절대 UI 로 노출하지 않는다(원문 SQLSTATE 유출 차단).
 */

export interface MappedRpcError {
  /** 특정 입력 필드에 귀속되면 그 키, 폼 전역이면 undefined */
  field?: OrderFieldKey;
  message: string;
}

export type OrderFieldKey =
  | 'items'
  | 'buyerName'
  | 'buyerPhone'
  | 'bizRegNo'
  | 'shipPostcode'
  | 'shipAddr1'
  | 'shipAddr2'
  | 'shipMemo'
  | 'buyerCompany'
  | 'depositorName';

const GENERIC_MESSAGE = '주문 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.';

/**
 * 영문 토큰 → 매핑. 한국어 문장은 이미 사용자 노출 가능하므로 별도 whitelist 로 통과시킨다.
 */
const TOKEN_MAP: Record<string, MappedRpcError> = {
  // 항목
  items_required: { field: 'items', message: '주문할 상품을 선택해 주세요.' },
  invalid_items: { field: 'items', message: '주문 항목 형식이 올바르지 않습니다.' },
  too_many_items: { field: 'items', message: '주문 항목이 너무 많습니다(최대 50종).' },
  invalid_qty: { field: 'items', message: '주문 수량은 1개 이상이어야 합니다.' },
  variant_not_found: { field: 'items', message: '선택하신 상품을 찾을 수 없습니다.' },
  variant_unavailable: { field: 'items', message: '현재 판매 중이 아닌 상품이 포함되어 있습니다.' },
  insufficient_stock: { field: 'items', message: '재고가 부족한 상품이 있습니다. 수량을 조정해 주세요.' },
  // 주문자
  buyer_name_required: { field: 'buyerName', message: '주문자명을 입력해 주세요.' },
  buyer_name_too_long: { field: 'buyerName', message: '주문자명은 100자 이내로 입력해 주세요.' },
  invalid_phone: { field: 'buyerPhone', message: '휴대폰 번호를 정확히 입력해 주세요.' },
  invalid_biz_reg_no: {
    field: 'bizRegNo',
    message: '세금계산서 발행을 위해 사업자등록번호 10자리를 입력해 주세요.',
  },
  // 배송
  shipping_required: { field: 'shipPostcode', message: '배송지 정보를 입력해 주세요.' },
  field_too_long: { message: '입력값 길이가 허용 범위를 초과했습니다.' },
  // 시스템 (전역)
  order_no_generation_failed: {
    message: '주문번호 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.',
  },
  pii_key_missing: { message: GENERIC_MESSAGE },
  unauthorized: { message: GENERIC_MESSAGE },
};

/**
 * 이미 한국어로 raise 된 문장들(FIX-3/4) — RPC 가 직접 만든 사용자 노출 안전 문장.
 * message 원문이 이 집합에 있으면 그대로 통과(필드 귀속 포함).
 */
const KOREAN_SENTENCE_MAP: { match: string; result: MappedRpcError }[] = [
  { match: '주문 항목이 너무 많습니다', result: { field: 'items', message: '주문 항목이 너무 많습니다(최대 50종).' } },
  { match: '주문 항목 형식이 올바르지 않습니다', result: { field: 'items', message: '주문 항목 형식이 올바르지 않습니다.' } },
  { match: '주문 수량은 1개 이상', result: { field: 'items', message: '주문 수량은 1개 이상이어야 합니다.' } },
  { match: '주문자명이 너무 깁니다', result: { field: 'buyerName', message: '주문자명은 100자 이내로 입력해 주세요.' } },
  { match: '입력값 길이가 허용범위를 초과', result: { message: '입력값 길이가 허용 범위를 초과했습니다.' } },
];

/**
 * RPC 에러 message 를 사용자 노출 에러로 변환한다.
 * 매칭 실패 시 { field:undefined, message: GENERIC } (원문 미노출) 반환하고,
 * 호출자는 이 경우 Sentry 로 원문을 캡처해야 한다(unknown 판별은 isUnknownRpcError 사용).
 */
export function mapRpcError(rawMessage: string | null | undefined): MappedRpcError {
  const msg = (rawMessage ?? '').trim();
  if (!msg) return { message: GENERIC_MESSAGE };

  // 1) 영문 토큰 정확 일치
  const token = TOKEN_MAP[msg];
  if (token) return token;

  // 2) 한국어 문장 부분 일치
  for (const entry of KOREAN_SENTENCE_MAP) {
    if (msg.includes(entry.match)) return entry.result;
  }

  // 3) 미지 — 원문 미노출
  return { message: GENERIC_MESSAGE };
}

/** message 가 알려진 토큰/문장에 해당하지 않으면 true (Sentry 캡처 대상 판별). */
export function isUnknownRpcError(rawMessage: string | null | undefined): boolean {
  const msg = (rawMessage ?? '').trim();
  if (!msg) return true;
  if (TOKEN_MAP[msg]) return false;
  return !KOREAN_SENTENCE_MAP.some((e) => msg.includes(e.match));
}

export { GENERIC_MESSAGE };
