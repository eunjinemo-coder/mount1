import { getServerClient } from '@mount/db';
import { ForbiddenError, RedirectError, requireRole } from '@mount/lib';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import { CancelForm } from './cancel-form';

export const metadata = { title: '취소 리포트' };

export default async function CancelPage(props: {
  params: Promise<{ orderId: string }>;
}): Promise<ReactElement> {
  const { orderId } = await props.params;

  try {
    await requireRole(['technician']);
  } catch (error) {
    if (error instanceof RedirectError) {
      redirect(`/login?redirect=${encodeURIComponent(`/order/${orderId}/cancel`)}`);
    }
    if (error instanceof ForbiddenError) redirect('/login?error=forbidden');
    throw error;
  }

  const client = await getServerClient();
  const { data: order } = await client
    .from('orders')
    .select('id, status')
    .eq('id', orderId)
    .maybeSingle();

  if (!order) notFound();

  return (
    <main className="bg-background safe-top safe-bottom min-h-dvh px-4 py-6">
      <div className="mx-auto max-w-screen-md space-y-6">
        <header>
          <Link href={`/order/${orderId}`} className="text-muted-foreground text-sm">
            ← 주문 상세로
          </Link>
          <h1 className="mt-2 text-2xl font-bold">취소 리포트</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            현장에서 시공이 불가능한 사유를 정확히 기록해 주세요. 본사가 쿠팡에 전달합니다.
          </p>
        </header>

        <CancelForm orderId={order.id} />
      </div>
    </main>
  );
}
