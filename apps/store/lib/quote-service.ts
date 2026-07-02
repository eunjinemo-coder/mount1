/**
 * 대량 견적 요청 코어 (S6) — server action 과 분리(단위 테스트 가능).
 *
 * store_quote_requests 는 anon 직접 INSERT 허용 테이블. status 는 보내지 않는다
 * (DB default 'new' + RLS with check(status='new')). phone 은 숫자만 저장(CHECK 하이픈 불허).
 */
import type { z } from 'zod';
import { quoteSchema } from './order-validation';

export type QuoteResult =
  | { ok: true }
  | {
      ok: false;
      fieldErrors?: { company?: string; contactName?: string; phone?: string; message?: string };
      formError?: string;
    };

export type InsertFn = (
  table: string,
  values: Record<string, unknown>,
) => Promise<{ error: { message: string } | null }>;
export type RateLimitFn = (
  key: string,
  limit: number,
  windowSeconds: number,
) => Promise<{ allowed: boolean }>;

export interface QuoteDeps {
  insert: InsertFn;
  rateLimit: RateLimitFn;
  rateLimitKey: string;
  onUnknownError?: (message: string, context: Record<string, unknown>) => void;
}

export const QUOTE_RATE_LIMIT = { limit: 3, windowSeconds: 60 } as const;

const RATE_LIMIT_MESSAGE = '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
const GENERIC_MESSAGE = '접수 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.';

function zodToFieldErrors(
  error: z.ZodError,
): { company?: string; contactName?: string; phone?: string; message?: string } {
  const out: { company?: string; contactName?: string; phone?: string; message?: string } = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !(key in out)) {
      (out as Record<string, string>)[key] = issue.message;
    }
  }
  return out;
}

export async function submitQuote(deps: QuoteDeps, rawInput: unknown): Promise<QuoteResult> {
  const parsed = quoteSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, fieldErrors: zodToFieldErrors(parsed.error) };
  }

  const rl = await deps.rateLimit(
    deps.rateLimitKey,
    QUOTE_RATE_LIMIT.limit,
    QUOTE_RATE_LIMIT.windowSeconds,
  );
  if (!rl.allowed) {
    return { ok: false, formError: RATE_LIMIT_MESSAGE };
  }

  // status 미포함 — DB default 'new' + RLS with check(status='new')
  const { error } = await deps.insert('store_quote_requests', {
    company: parsed.data.company,
    contact_name: parsed.data.contactName,
    phone: parsed.data.phone,
    message: parsed.data.message,
  });

  if (error) {
    deps.onUnknownError?.(error.message, { where: 'store_quote_requests.insert' });
    return { ok: false, formError: GENERIC_MESSAGE };
  }

  return { ok: true };
}
