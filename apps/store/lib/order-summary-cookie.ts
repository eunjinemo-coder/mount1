/**
 * 주문완료(S4) 요약 서명 토큰.
 *
 * 문제: /order/done/[orderNo] 는 anon 페이지라 store_orders 를 직접 SELECT 할 수 없고
 *   (RLS deny), lookup_store_order 는 휴대폰이 필요해 done 페이지에서 재조회가 불가능하다.
 *   그렇다고 금액·기한을 URL 쿼리로 넘기면 사용자가 표시 금액을 위조할 수 있다.
 *
 * 해법: create_store_order 성공 직후 서버가 {orderNo,total,expiresAt} 를 HMAC 서명해
 *   httpOnly 쿠키로 심고, done 페이지는 이 토큰을 서버에서 검증(서명 + orderNo 일치)한 뒤
 *   금액을 렌더한다. 서명 불일치/부재면 금액을 숨기고 조회 페이지로 유도한다.
 *   → 금액은 항상 서버가 발급한 값이며 URL·클라이언트로 위조 불가.
 *
 * ⚠️ 서버 전용 (node:crypto). 클라이언트에서 import 금지.
 * sign/verify 는 순수 함수로 유지(단위 테스트 대상). 쿠키 set/get 은 호출부에서 next/headers 로.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface OrderSummary {
  orderNo: string;
  total: number;
  expiresAt: string;
}

export const ORDER_SUMMARY_COOKIE = 'wp_order_summary';
/** 완료 화면 재방문 여유 — 24h. 이후엔 조회 페이지로 유도. */
export const ORDER_SUMMARY_MAX_AGE = 60 * 60 * 24;

/**
 * 서명 시크릿. 운영에서는 STORE_ORDER_SUMMARY_SECRET 를 반드시 설정한다.
 * 미설정 시 SUPABASE_JWT_SECRET 로 대체(존재 보장), 그마저 없으면 dev 고정값(경고).
 */
function getSecret(): string {
  const secret =
    process.env.STORE_ORDER_SUMMARY_SECRET ?? process.env.SUPABASE_JWT_SECRET;
  if (secret && secret.length > 0) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'STORE_ORDER_SUMMARY_SECRET (또는 SUPABASE_JWT_SECRET) 미설정 — 주문요약 서명 불가',
    );
  }
  return 'dev-insecure-order-summary-secret';
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function hmac(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

/** 요약을 서명해 `payload.sig` 토큰 문자열로 반환. */
export function signOrderSummary(summary: OrderSummary, secret = getSecret()): string {
  const payload = b64url(JSON.stringify(summary));
  return `${payload}.${hmac(payload, secret)}`;
}

/**
 * 토큰 검증 + orderNo 일치 확인. 실패 시 null.
 *   서명 위조·변조·orderNo 불일치·형식오류 모두 null 로 처리(금액 미노출).
 */
export function verifyOrderSummary(
  token: string | undefined | null,
  expectedOrderNo: string,
  secret = getSecret(),
): OrderSummary | null {
  if (!token) return null;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;

  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = hmac(payload, secret);

  // 상수시간 비교 (길이 다르면 즉시 실패)
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as OrderSummary;
    if (
      !parsed ||
      typeof parsed.orderNo !== 'string' ||
      typeof parsed.total !== 'number' ||
      typeof parsed.expiresAt !== 'string'
    ) {
      return null;
    }
    if (parsed.orderNo !== expectedOrderNo) return null;
    return parsed;
  } catch {
    return null;
  }
}
