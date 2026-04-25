import { getServerClient } from '@mount/db';
import { ForbiddenError, RedirectError, requireRole } from '@mount/lib';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import { DriverShell } from '../_layout/driver-shell';
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
  let session;
  try {
    session = await requireRole(['technician']);
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
  const [todayResult, technicianResult] = await Promise.all([
    client
      .from('v_technician_today')
      .select('*')
      .order('scheduled_installation_at', { ascending: true }),
    session.technicianId
      ? client
          .from('technicians')
          .select('display_name')
          .eq('id', session.technicianId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const orders = !todayResult.error && todayResult.data ? todayResult.data : [];
  const technicianName = technicianResult.data?.display_name ?? '기사';
  const completedCount = orders.filter((o) =>
    ['no_drill_completed', 'drill_converted_completed', 'paid', 'closed'].includes(o.status ?? ''),
  ).length;
  const inProgressCount = orders.filter((o) =>
    ['en_route', 'on_site', 'in_progress'].includes(o.status ?? ''),
  ).length;
  const upcomingCount = orders.length - completedCount - inProgressCount;

  return (
    <DriverShell activeTab="home" technicianName={technicianName}>
      <div className="mx-auto max-w-screen-md px-4 py-6">
        <header className="mb-4 flex items-baseline justify-between">
          <h1 className="text-2xl font-bold">오늘의 시공</h1>
          <p className="text-muted-foreground text-sm">{DATE_FORMATTER.format(new Date())}</p>
        </header>

        {orders.length > 0 ? (
          <p className="text-muted-foreground mb-4 text-sm">
            총 <span className="text-foreground font-semibold">{orders.length}건</span> · 완료 {completedCount} · 진행 {inProgressCount} · 예정 {upcomingCount}
          </p>
        ) : null}

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
    </DriverShell>
  );
}
