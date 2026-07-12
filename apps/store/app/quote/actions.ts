'use server';

/**
 * 대량 견적 요청 server action (S6).
 * lib/quote-service.ts 코어에 실 anon INSERT·rateLimit·Sentry 를 주입한다.
 * store_quote_requests 는 generated types 미포함(pre-push) → storeTable façade 로 INSERT.
 */
import { captureMessage, rateLimit } from '@mount/lib';
import { getStoreServerClient } from '@/lib/supabase';
import { getClientIp } from '@/lib/client-ip';
import { storeTable } from '@/lib/store-tables';
import { submitQuote, type QuoteResult } from '@/lib/quote-service';

export async function submitQuoteAction(input: unknown): Promise<QuoteResult> {
  const ip = await getClientIp();
  const supabase = await getStoreServerClient();

  return submitQuote(
    {
      insert: async (table, values) => {
        const { error } = await storeTable(supabase, table).insert(values);
        return { error };
      },
      rateLimit,
      rateLimitKey: `store_quote:${ip}`,
      onUnknownError: (message, context) =>
        captureMessage(`store_quote insert 오류: ${message}`, 'error', context),
    },
    input,
  );
}
