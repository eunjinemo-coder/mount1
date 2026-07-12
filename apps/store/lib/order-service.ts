/**
 * 주문 생성 코어 로직 (server action 과 분리 → 단위 테스트 가능).
 *
 * next/headers·@mount/db 를 직접 import 하지 않고 의존성을 주입받는다:
 *   · rpc       — create_store_order 호출 (테스트에선 mock)
 *   · rateLimit — @mount/lib rateLimit (테스트에선 mock)
 *   · onUnknownError — Sentry 캡처 훅 (미지 에러만)
 *
 * 흐름: zod 검증(fail-fast) → rate limit → RPC → 에러매핑. 원문 SQLSTATE/message 미노출.
 */
import type { z } from 'zod';
import { orderSchema, type OrderInput } from './order-validation';
import {
  mapRpcError,
  isUnknownRpcError,
  GENERIC_MESSAGE,
  type OrderFieldKey,
} from './order-errors';

export type OrderFieldErrors = Partial<Record<OrderFieldKey | 'clientKey' | 'slug', string>>;

export type OrderResult =
  | { ok: true; orderNo: string; total: number; expiresAt: string }
  | { ok: false; fieldErrors?: OrderFieldErrors; formError?: string };

export interface RpcResponse {
  data: unknown;
  error: { message: string } | null;
}
export type RpcFn = (name: string, args: Record<string, unknown>) => Promise<RpcResponse>;
export type RateLimitFn = (
  key: string,
  limit: number,
  windowSeconds: number,
) => Promise<{ allowed: boolean }>;

export interface OrderDeps {
  rpc: RpcFn;
  rateLimit: RateLimitFn;
  rateLimitKey: string;
  onUnknownError?: (message: string, context: Record<string, unknown>) => void;
}

/** 주문 제출 rate limit — IP 기준 분당 5회 (best-effort, 실 강제는 edge/Upstash). */
export const ORDER_RATE_LIMIT = { limit: 5, windowSeconds: 60 } as const;

const RATE_LIMIT_MESSAGE = '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';

/** zod 이슈 → 필드 에러(필드당 첫 메시지). */
function zodToFieldErrors(error: z.ZodError): OrderFieldErrors {
  const out: OrderFieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !(key in out)) {
      (out as Record<string, string>)[key] = issue.message;
    }
  }
  return out;
}

/** 검증된 입력 → RPC 인자(snake_case, 빈 문자열→null). buyerPhone/bizRegNo 는 이미 숫자정규화됨. */
function toRpcArgs(input: OrderInput): Record<string, unknown> {
  const nul = (v: string | undefined): string | null => {
    const t = (v ?? '').trim();
    return t.length === 0 ? null : t;
  };
  return {
    p_client_key: input.clientKey,
    p_items: input.items.map((i) => ({ variant_id: i.variantId, qty: i.qty })),
    p_buyer_name: input.buyerName,
    p_buyer_phone: input.buyerPhone,
    p_ship_postcode: input.shipPostcode,
    p_ship_addr1: input.shipAddr1,
    p_buyer_company: nul(input.buyerCompany),
    p_tax_invoice: input.taxInvoice,
    p_biz_reg_no: input.taxInvoice ? nul(input.bizRegNo) : null,
    p_ship_addr2: nul(input.shipAddr2),
    p_ship_memo: nul(input.shipMemo),
    p_depositor_name: nul(input.depositorName),
  };
}

export async function createOrder(deps: OrderDeps, rawInput: unknown): Promise<OrderResult> {
  // 1) zod 검증 — 실패 시 RPC 미호출
  const parsed = orderSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, fieldErrors: zodToFieldErrors(parsed.error) };
  }
  const input = parsed.data;

  // 2) rate limit (best-effort)
  const rl = await deps.rateLimit(
    deps.rateLimitKey,
    ORDER_RATE_LIMIT.limit,
    ORDER_RATE_LIMIT.windowSeconds,
  );
  if (!rl.allowed) {
    return { ok: false, formError: RATE_LIMIT_MESSAGE };
  }

  // 3) RPC 호출
  const { data, error } = await deps.rpc('create_store_order', toRpcArgs(input));
  if (error) {
    if (isUnknownRpcError(error.message)) {
      deps.onUnknownError?.(error.message, { where: 'create_store_order' });
    }
    const mapped = mapRpcError(error.message);
    if (mapped.field) {
      return { ok: false, fieldErrors: { [mapped.field]: mapped.message } };
    }
    return { ok: false, formError: mapped.message };
  }

  const result = data as
    | { order_no?: string; total_amount?: number; expires_at?: string }
    | null;
  if (!result || typeof result.order_no !== 'string') {
    deps.onUnknownError?.('empty_rpc_result', { where: 'create_store_order' });
    return { ok: false, formError: GENERIC_MESSAGE };
  }

  return {
    ok: true,
    orderNo: result.order_no,
    total: typeof result.total_amount === 'number' ? result.total_amount : 0,
    expiresAt: typeof result.expires_at === 'string' ? result.expires_at : '',
  };
}
