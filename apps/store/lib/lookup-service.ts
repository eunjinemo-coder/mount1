/**
 * 주문 조회 코어 (S5) — server action 과 분리(단위 테스트 가능).
 *
 * lookup_store_order RPC 는 미존재·전화불일치를 모두 null 로 반환(열거 방지). 이 계층도
 * 그 대칭을 유지해 항상 동일한 "일치하는 주문이 없습니다" 를 노출한다.
 */
import type { z } from 'zod';
import { lookupSchema } from './order-validation';

export interface LookupOrderItem {
  name: string;
  variant: string;
  qty: number;
  unit_price: number;
  subtotal: number;
}

export interface LookupShipment {
  carrier: string;
  tracking_no: string;
  shipped_at: string;
}

export interface LookupOrder {
  order_no: string;
  status: string;
  created_at: string;
  paid_at: string | null;
  expires_at: string;
  total_amount: number;
  items: LookupOrderItem[];
  shipment: LookupShipment | null;
}

export type LookupResult =
  | { ok: true; order: LookupOrder }
  | { ok: false; fieldErrors?: { orderNo?: string; phone?: string }; formError?: string };

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

export interface LookupDeps {
  rpc: RpcFn;
  rateLimit: RateLimitFn;
  rateLimitKey: string;
  onUnknownError?: (message: string, context: Record<string, unknown>) => void;
}

export const LOOKUP_RATE_LIMIT = { limit: 10, windowSeconds: 60 } as const;

/** 미존재·불일치 공통 메시지 (열거 방지) */
export const NO_MATCH_MESSAGE = '일치하는 주문이 없습니다. 주문번호와 휴대폰 번호를 확인해 주세요.';
const RATE_LIMIT_MESSAGE = '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';

function zodToFieldErrors(error: z.ZodError): { orderNo?: string; phone?: string } {
  const out: { orderNo?: string; phone?: string } = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (key === 'orderNo' && !out.orderNo) out.orderNo = issue.message;
    if (key === 'phone' && !out.phone) out.phone = issue.message;
  }
  return out;
}

export async function lookupOrder(deps: LookupDeps, rawInput: unknown): Promise<LookupResult> {
  const parsed = lookupSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, fieldErrors: zodToFieldErrors(parsed.error) };
  }

  const rl = await deps.rateLimit(
    deps.rateLimitKey,
    LOOKUP_RATE_LIMIT.limit,
    LOOKUP_RATE_LIMIT.windowSeconds,
  );
  if (!rl.allowed) {
    return { ok: false, formError: RATE_LIMIT_MESSAGE };
  }

  const { data, error } = await deps.rpc('lookup_store_order', {
    p_order_no: parsed.data.orderNo,
    p_phone: parsed.data.phone,
  });

  if (error) {
    deps.onUnknownError?.(error.message, { where: 'lookup_store_order' });
    // 내부 오류도 조회 실패와 동일 메시지로 흡수(정보 누출 방지)
    return { ok: false, formError: NO_MATCH_MESSAGE };
  }

  // RPC 는 미존재/불일치 시 null 반환
  if (data == null) {
    return { ok: false, formError: NO_MATCH_MESSAGE };
  }

  return { ok: true, order: data as LookupOrder };
}
