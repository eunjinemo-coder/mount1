import { getServerClient } from '@mount/db';
import { ForbiddenError, RedirectError, requireRole } from '@mount/lib';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import { EmptyState } from './empty-state';
import { OrderCard } from './order-card';

export const metadata = { title: '오늘의 시공' };

const DATE_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'short',
  timeZone: 'Asia/Seoul',
});

export default async function TodayPage(): Promise<ReactElement> {
  try {
    await requireRole(['technician']);
  } catch (error) {
    if (error instanceof RedirectError) {
      redirect(`/login?redirect=${encodeURIComponent('/today')}`);
    }
    if (error instanceof ForbiddenError) {
      redirect('/login?error=forbidden');
    }
    throw error;
  }

  const client = await getServerClient();
  const { data, error } = await client
    .from('v_technician_today')
    .select('*')
    .order('scheduled_installation_at', { ascending: true });

  const orders = !error && data ? data : [];

  return (
    <main className="bg-background safe-top safe-bottom min-h-dvh px-4 py-6">
      <div className="mx-auto max-w-screen-md">
        <header className="mb-6 flex items-baseline justify-between">
          <h1 className="text-2xl font-bold">오늘의 시공</h1>
          <p className="text-muted-foreground text-sm">{DATE_FORMATTER.format(new Date())}</p>
        </header>

        {orders.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-3">
            {orders.map((order) => (
              <OrderCard
                key={order.order_id ?? ''}
                order_id={order.order_id ?? ''}
                phone_tail4={order.phone_tail4 ?? ''}
                photo_count={order.photo_count ?? 0}
                pre_call_done={order.pre_call_done ?? false}
                region={order.region ?? ''}
                scheduled_installation_at={order.scheduled_installation_at}
                status={order.status ?? ''}
                tv={order.tv ?? ''}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
