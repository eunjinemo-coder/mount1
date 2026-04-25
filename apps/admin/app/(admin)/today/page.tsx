import { getServerClient } from '@mount/db';
import { ForbiddenError, RedirectError, requireRole } from '@mount/lib';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import { AdminShell } from '../_layout/admin-shell';
import { KpiCard } from './kpi-card';
import { TechnicianBars } from './technician-bars';
import { UnassignedBanner } from './unassigned-banner';

export const metadata = { title: '오늘 운영 현황' };

const TIME_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Seoul',
});

const PROGRESS_STATUSES = ['en_route', 'on_site', 'in_progress'];
const COMPLETED_STATUSES = [
  'no_drill_completed',
  'drill_converted_completed',
  'awaiting_payment',
  'payment_sent',
  'paid',
  'closed',
];
const CANCELLED_STATUSES = ['cancel_requested', 'cancel_confirmed_coupang_transfer'];

function todayKstRange(): { start: string; end: string } {
  const now = new Date();
  const kstOffsetMs = 9 * 60 * 60 * 1000;
  const kstNow = new Date(now.getTime() + kstOffsetMs);
  const y = kstNow.getUTCFullYear();
  const m = kstNow.getUTCMonth();
  const d = kstNow.getUTCDate();
  const startUtc = new Date(Date.UTC(y, m, d, 0, 0, 0) - kstOffsetMs);
  const endUtc = new Date(Date.UTC(y, m, d + 1, 0, 0, 0) - kstOffsetMs);
  return { start: startUtc.toISOString(), end: endUtc.toISOString() };
}

export default async function AdminTodayPage(): Promise<ReactElement> {
  try {
    await requireRole(['admin']);
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
  const { start, end } = todayKstRange();

  const todayQuery = client
    .from('v_orders_dashboard')
    .select('id, status, technician_name')
    .gte('scheduled_installation_at', start)
    .lt('scheduled_installation_at', end);

  const progressQuery = client
    .from('v_orders_dashboard')
    .select('id', { count: 'exact', head: true })
    .in('status', PROGRESS_STATUSES);

  const completedQuery = client
    .from('v_orders_dashboard')
    .select('id', { count: 'exact', head: true })
    .in('status', COMPLETED_STATUSES)
    .gte('scheduled_installation_at', start)
    .lt('scheduled_installation_at', end);

  const cancelledQuery = client
    .from('v_orders_dashboard')
    .select('id', { count: 'exact', head: true })
    .in('status', CANCELLED_STATUSES)
    .gte('scheduled_installation_at', start)
    .lt('scheduled_installation_at', end);

  const [todayResult, progressResult, completedResult, cancelledResult] = await Promise.all([
    todayQuery,
    progressQuery,
    completedQuery,
    cancelledQuery,
  ]);

  const todayOrders = todayResult.data ?? [];
  const todayCount = todayOrders.length;
  const unassignedCount = todayOrders.filter((order) => !order.technician_name).length;

  const technicianCounts = new Map<string, number>();
  for (const order of todayOrders) {
    if (!order.technician_name) continue;
    technicianCounts.set(order.technician_name, (technicianCounts.get(order.technician_name) ?? 0) + 1);
  }
  const technicianStats = [...technicianCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  const technicianMax = technicianStats[0]?.count ?? 0;

  return (
    <AdminShell activeNav="today" notificationCount={unassignedCount} title="Today">
      <div className="mx-auto max-w-screen-2xl space-y-6 px-6 py-6">
        <header className="flex items-baseline justify-between">
          <h2 className="text-2xl font-bold">오늘 운영 현황</h2>
          <p className="text-muted-foreground text-sm">기준 시각 {TIME_FORMATTER.format(new Date())}</p>
        </header>

        {unassignedCount > 0 ? <UnassignedBanner count={unassignedCount} /> : null}

        <div className="grid gap-4 md:grid-cols-4">
          <KpiCard label="오늘 배차" value={todayCount} hint="모든 상태 합계" />
          <KpiCard
            label="진행 중"
            value={progressResult.count ?? 0}
            tone="warning"
            hint="이동·도착·시공"
          />
          <KpiCard
            label="완료"
            value={completedResult.count ?? 0}
            tone="success"
            hint="시공·결제 완료"
          />
          <KpiCard
            label="취소"
            value={cancelledResult.count ?? 0}
            tone={cancelledResult.count && cancelledResult.count > 0 ? 'destructive' : 'default'}
            hint="요청·확정 합계"
          />
        </div>

        <TechnicianBars max={technicianMax} stats={technicianStats} />
      </div>
    </AdminShell>
  );
}
