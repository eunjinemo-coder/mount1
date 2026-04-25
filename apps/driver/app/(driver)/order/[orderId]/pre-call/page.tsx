import { getServerClient } from '@mount/db';
import { ForbiddenError, RedirectError, requireRole } from '@mount/lib';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import { PreCallForm } from './pre-call-form';

export const metadata = { title: '사전 통화' };

export default async function PreCallPage(props: {
  params: Promise<{ orderId: string }>;
}): Promise<ReactElement> {
  const { orderId } = await props.params;

  try {
    await requireRole(['technician']);
  } catch (error) {
    if (error instanceof RedirectError) {
      redirect(`/login?redirect=${encodeURIComponent(`/order/${orderId}/pre-call`)}`);
    }
    if (error instanceof ForbiddenError) redirect('/login?error=forbidden');
    throw error;
  }

  const client = await getServerClient();
  const { data: order } = await client
    .from('orders')
    .select('id, status, scheduled_installation_at, customer_id')
    .eq('id', orderId)
    .maybeSingle();

  if (!order) notFound();

  // 30분 전 통화는 assigned/en_route 상태에서만 (현장 도착 전)
  const CALLABLE = ['assigned', 'en_route'] as const;
  if (!CALLABLE.includes(order.status as (typeof CALLABLE)[number])) {
    redirect(`/order/${orderId}`);
  }

  // v_customer_for_technician 으로 전화 뒷자리만 조회 (PII 최소 노출)
  // P1-NEW-3 fix: 뷰는 customers.id 기반이므로 order.customer_id 로 조회
  const customerResult = order.customer_id
    ? await client
        .from('v_customer_for_technician')
        .select('phone_tail4')
        .eq('id', order.customer_id)
        .maybeSingle()
    : { data: null };
  const customer = customerResult.data;

  return (
    <main className="bg-background safe-top safe-bottom min-h-dvh px-4 py-6">
      <div className="mx-auto max-w-screen-md space-y-6">
        <header>
          <Link href={`/order/${orderId}`} className="text-muted-foreground text-sm">
            ← 주문 상세로
          </Link>
          <h1 className="mt-2 text-2xl font-bold">사전 통화 (30분 전)</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            도착 약 30분 전 고객에게 전화드려 위치·접근 방법을 안내합니다.
          </p>
        </header>

        <PreCallForm orderId={order.id} phoneTail4={customer?.phone_tail4 ?? ''} />
      </div>
    </main>
  );
}
