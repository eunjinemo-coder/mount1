'use server';

/**
 * 주문 server action (S3 → S4).
 *
 * 얇은 어댑터: 실 Supabase anon 클라이언트·rateLimit·Sentry·쿠키를 order-service 코어에
 * 주입한다. 핵심 로직·에러매핑은 lib/order-service.ts 에 있고 여기서 검증하지 않는다.
 *
 * 성공 시 서명된 주문요약 쿠키를 심는다 → S4 done 페이지가 URL 위조 없이 금액을 표시.
 * 리다이렉트는 클라이언트(order-form)가 result.orderNo 로 수행.
 */
import { cookies } from 'next/headers';
import { captureMessage, rateLimit } from '@mount/lib';
import { callRpc, getStoreServerClient } from '@/lib/supabase';
import { getClientIp } from '@/lib/client-ip';
import { createOrder, type OrderResult } from '@/lib/order-service';
import {
  ORDER_SUMMARY_COOKIE,
  ORDER_SUMMARY_MAX_AGE,
  signOrderSummary,
} from '@/lib/order-summary-cookie';

export async function submitOrderAction(input: unknown): Promise<OrderResult> {
  const ip = await getClientIp();
  const supabase = await getStoreServerClient();

  const result = await createOrder(
    {
      rpc: (name, args) => callRpc(supabase, name, args),
      rateLimit,
      rateLimitKey: `store_order:${ip}`,
      onUnknownError: (message, context) =>
        captureMessage(`create_store_order 미매핑 에러: ${message}`, 'error', context),
    },
    input,
  );

  if (result.ok) {
    const cookieStore = await cookies();
    cookieStore.set(
      ORDER_SUMMARY_COOKIE,
      signOrderSummary({
        orderNo: result.orderNo,
        total: result.total,
        expiresAt: result.expiresAt,
      }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/order/done',
        maxAge: ORDER_SUMMARY_MAX_AGE,
      },
    );
  }

  return result;
}
