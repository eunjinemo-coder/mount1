import { getServerClient } from '@mount/db';
import { ForbiddenError, RedirectError, requireRole } from '@mount/lib';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import { CompleteForm } from './complete-form';

export const metadata = { title: '시공 완료' };

export default async function CompletePage(props: {
  params: Promise<{ orderId: string }>;
}): Promise<ReactElement> {
  const { orderId } = await props.params;

  try {
    await requireRole(['technician']);
  } catch (error) {
    if (error instanceof RedirectError) {
      redirect(`/login?redirect=${encodeURIComponent(`/order/${orderId}/complete`)}`);
    }
    if (error instanceof ForbiddenError) redirect('/login?error=forbidden');
    throw error;
  }

  const client = await getServerClient();
  const { data: order } = await client
    .from('orders')
    .select('id, status, price_option_b, price_option_c')
    .eq('id', orderId)
    .maybeSingle();

  if (!order) notFound();

  const priceB = order.price_option_b ? Number(order.price_option_b) : 0;
  const priceC = order.price_option_c ? Number(order.price_option_c) : 0;

  return (
    <main className="bg-background safe-top safe-bottom min-h-dvh px-4 py-6">
      <div className="mx-auto max-w-screen-md space-y-6">
        <header>
          <Link href={`/order/${orderId}`} className="text-muted-foreground text-sm">
            ← 주문 상세로
          </Link>
          <h1 className="mt-2 text-2xl font-bold">시공 완료</h1>
        </header>

        <CompleteForm
          orderId={order.id}
          priceB={priceB}
          priceC={priceC}
          status={order.status}
        />
      </div>
    </main>
  );
}
