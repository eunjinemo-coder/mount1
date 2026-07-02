'use server';

/**
 * 주문 조회 server action (S5).
 * lib/lookup-service.ts 코어에 실 클라이언트·rateLimit·Sentry 를 주입한다.
 */
import { captureMessage, rateLimit } from '@mount/lib';
import { callRpc, getStoreServerClient } from '@/lib/supabase';
import { getClientIp } from '@/lib/client-ip';
import { lookupOrder, type LookupResult } from '@/lib/lookup-service';

export async function lookupOrderAction(input: unknown): Promise<LookupResult> {
  const ip = await getClientIp();
  const supabase = await getStoreServerClient();

  return lookupOrder(
    {
      rpc: (name, args) => callRpc(supabase, name, args),
      rateLimit,
      rateLimitKey: `store_lookup:${ip}`,
      onUnknownError: (message, context) =>
        captureMessage(`lookup_store_order 오류: ${message}`, 'error', context),
    },
    input,
  );
}
