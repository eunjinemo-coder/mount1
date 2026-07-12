/**
 * 주문·견적 공유 검증 (zod) — S3 주문서 · S5 조회 · S6 견적폼의 단일 진실 원천.
 *
 * 클라이언트(order-form/quote-form)와 서버 액션(order-service/quote-service)이
 * 동일 스키마·상수를 공유한다. 길이 상한은 0021_store.sql 의 테이블 CHECK 와 정확히 일치.
 *
 * ⚠️ 클라이언트 번들에도 들어가므로 서버 전용 모듈(@mount/db, next/headers 등)을
 *   여기서 import 하지 않는다. zod 는 isomorphic 이라 안전.
 */
import { z } from 'zod';

/** 한국 휴대폰 — 숫자만 정규화한 뒤 검사 (0021_store.sql create_store_order 와 동일 패턴) */
export const PHONE_RE = /^01[016789][0-9]{7,8}$/;

/** 휴대폰 접두 검사 — 부분 입력 중 즉각 피드백용 (quote-form 하위호환) */
export const PHONE_PREFIX_RE = /^01[016789]/;

/** UUID v4 형식 — variantId·clientKey. (@mount/lib 서버 모듈 의존 회피 위해 로컬 정의) */
export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 사업자등록번호 — 숫자 10자리 (세금계산서 요청 시 필수) */
export const BIZ_REG_RE = /^[0-9]{10}$/;

/**
 * 필드 길이 상한 — 0021_store.sql CHECK 미러.
 *   buyer_name/company/depositor ≤100 · postcode ≤20 · addr1/addr2 ≤300 ·
 *   memo ≤500 · biz_reg_no ≤20(형식은 10자리) · items ≤50
 */
export const LIMITS = {
  name: { min: 1, max: 100 },
  company: { max: 100 },
  depositor: { max: 100 },
  bizRegNo: { max: 20 },
  postcode: { min: 1, max: 20 },
  addr1: { min: 1, max: 300 },
  addr2: { max: 300 },
  memo: { max: 500 },
  items: { max: 50 },
  /** 수량 상한 — RPC 정규식 ^[0-9]{1,6}$ 와 정합(1~999999). UI 는 재고로 추가 제한. */
  qty: { min: 1, max: 999999 },
  // 견적폼 (store_quote_requests CHECK)
  quoteCompany: { min: 1, max: 100 },
  quoteContact: { min: 1, max: 100 },
  quoteMessage: { min: 1, max: 1000 },
} as const;

/** 전화 입력에서 숫자만 남긴다 (하이픈·공백 제거). DB 는 숫자만 저장. */
export function normalizePhoneDigits(raw: string): string {
  return raw.replace(/\D/g, '');
}

/** 사업자번호에서 숫자만 남긴다. */
export function normalizeBizRegDigits(raw: string): string {
  return raw.replace(/\D/g, '');
}

// ─────────────────────────────────────────────────────────────────────────────
// 주문 항목
// ─────────────────────────────────────────────────────────────────────────────
export const orderItemSchema = z.object({
  variantId: z.string().regex(UUID_RE, '상품 선택이 올바르지 않습니다.'),
  qty: z
    .number({ invalid_type_error: '수량을 입력해 주세요.' })
    .int('수량은 정수여야 합니다.')
    .min(LIMITS.qty.min, '수량은 1개 이상이어야 합니다.')
    .max(LIMITS.qty.max, '수량이 너무 많습니다.'),
});

export type OrderItemInput = z.infer<typeof orderItemSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// 주문 전체 페이로드 (server action 입력)
// ─────────────────────────────────────────────────────────────────────────────
export const orderSchema = z
  .object({
    clientKey: z.string().regex(UUID_RE, '요청 식별자가 올바르지 않습니다.'),
    slug: z.string().min(1).max(200),
    items: z
      .array(orderItemSchema)
      .min(1, '주문할 상품을 선택해 주세요.')
      .max(LIMITS.items.max, `주문 항목이 너무 많습니다(최대 ${LIMITS.items.max}종).`),
    buyerName: z
      .string()
      .trim()
      .min(LIMITS.name.min, '주문자명을 입력해 주세요.')
      .max(LIMITS.name.max, `주문자명은 ${LIMITS.name.max}자 이내로 입력해 주세요.`),
    // 클라이언트에서 숫자만 정규화 후 전송하지만 서버에서도 정규화·검사(신뢰 금지)
    buyerPhone: z
      .string()
      .transform(normalizePhoneDigits)
      .refine((v) => PHONE_RE.test(v), '휴대폰 번호를 정확히 입력해 주세요.'),
    buyerCompany: z
      .string()
      .trim()
      .max(LIMITS.company.max, `상호는 ${LIMITS.company.max}자 이내로 입력해 주세요.`)
      .optional()
      .or(z.literal('')),
    taxInvoice: z.boolean().default(false),
    bizRegNo: z
      .string()
      .transform(normalizeBizRegDigits)
      .optional()
      .or(z.literal('')),
    shipPostcode: z
      .string()
      .trim()
      .min(LIMITS.postcode.min, '우편번호를 입력해 주세요.')
      .max(LIMITS.postcode.max, '우편번호가 올바르지 않습니다.'),
    shipAddr1: z
      .string()
      .trim()
      .min(LIMITS.addr1.min, '배송지 주소를 입력해 주세요.')
      .max(LIMITS.addr1.max, `주소는 ${LIMITS.addr1.max}자 이내로 입력해 주세요.`),
    shipAddr2: z
      .string()
      .trim()
      .max(LIMITS.addr2.max, `상세주소는 ${LIMITS.addr2.max}자 이내로 입력해 주세요.`)
      .optional()
      .or(z.literal('')),
    shipMemo: z
      .string()
      .trim()
      .max(LIMITS.memo.max, `배송 메모는 ${LIMITS.memo.max}자 이내로 입력해 주세요.`)
      .optional()
      .or(z.literal('')),
    depositorName: z
      .string()
      .trim()
      .max(LIMITS.depositor.max, `입금자명은 ${LIMITS.depositor.max}자 이내로 입력해 주세요.`)
      .optional()
      .or(z.literal('')),
  })
  .superRefine((data, ctx) => {
    // 세금계산서 요청 시 사업자번호(숫자 10자리) 필수
    if (data.taxInvoice) {
      const biz = data.bizRegNo ?? '';
      if (!BIZ_REG_RE.test(biz)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['bizRegNo'],
          message: '세금계산서 발행을 위해 사업자등록번호 10자리를 입력해 주세요.',
        });
      }
    }
  });

export type OrderInput = z.infer<typeof orderSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// 주문 조회 (S5)
// ─────────────────────────────────────────────────────────────────────────────
/** 주문번호 포맷 안내·검사 — WP + yymmdd + '-' + 6자리 (예: WP260703-483920) */
export const ORDER_NO_RE = /^WP[0-9]{6}-[0-9]{6}$/;

export const lookupSchema = z.object({
  orderNo: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine((v) => ORDER_NO_RE.test(v), '주문번호 형식을 확인해 주세요. 예: WP260703-483920'),
  phone: z
    .string()
    .transform(normalizePhoneDigits)
    .refine((v) => PHONE_RE.test(v), '휴대폰 번호를 정확히 입력해 주세요.'),
});

export type LookupInput = z.infer<typeof lookupSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// 대량 견적 요청 (S6)
// ─────────────────────────────────────────────────────────────────────────────
export const quoteSchema = z.object({
  company: z
    .string()
    .trim()
    .min(LIMITS.quoteCompany.min, '상호를 입력해 주세요.')
    .max(LIMITS.quoteCompany.max, '상호는 100자 이내로 입력해 주세요.'),
  contactName: z
    .string()
    .trim()
    .min(LIMITS.quoteContact.min, '담당자명을 입력해 주세요.')
    .max(LIMITS.quoteContact.max, '담당자명은 100자 이내로 입력해 주세요.'),
  phone: z
    .string()
    .transform(normalizePhoneDigits)
    .refine((v) => PHONE_RE.test(v), '휴대폰 번호를 정확히 입력해 주세요.'),
  message: z
    .string()
    .trim()
    .min(LIMITS.quoteMessage.min, '문의 내용을 입력해 주세요.')
    .max(LIMITS.quoteMessage.max, '문의 내용은 1,000자 이내로 입력해 주세요.'),
});

export type QuoteInput = z.infer<typeof quoteSchema>;
