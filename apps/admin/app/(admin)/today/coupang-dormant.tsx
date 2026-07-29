import { getServerClient } from '@mount/db';
import { IN_PROGRESS_ORDER_STATUSES } from '@mount/lib';
import type { ReactElement } from 'react';
import { AlertsPanel } from './alerts-panel';
import { KpiCard } from './kpi-card';
import { TechnicianBars } from './technician-bars';
import { UnassignedBanner } from './unassigned-banner';

/**
 * 쿠팡 파일럿(dormant) 운영 구획 — KPI 6종 + 미배차 배너 + 알림 + 기사 부하.
 *
 * 별도 async 컴포넌트로 분리해 Suspense 스트리밍: 이 6개 쿼리가 "오늘 본사 시공"(코어)의
 * 첫 페인트를 붙잡지 않는다(페이지 전환 체감 지연의 원인이었음). 모바일에선 섹션 자체 숨김.
 */
const PROGRESS_STATUSES = IN_PROGRESS_ORDER_STATUSES;
// admin/today 의 "완료" 는 결제 흐름 포함 — driver 정산 그룹과 다른 의미라 component-local 유지.
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

export async function CoupangDormant(): Promise<ReactElement> {
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

  const unpaidQuery = client
    .from('v_orders_dashboard')
    .select('id', { count: 'exact', head: true })
    .in('status', ['awaiting_payment', 'payment_sent'])
    .gte('scheduled_installation_at', start)
    .lt('scheduled_installation_at', end);

  const issuesQuery = client
    .from('issues')
    .select('id', { count: 'exact', head: true })
    .gte('reported_at', start)
    .lt('reported_at', end);

  const [todayResult, progressResult, completedResult, cancelledResult, unpaidResult, issuesResult] =
    await Promise.all([todayQuery, progressQuery, completedQuery, cancelledQuery, unpaidQuery, issuesQuery]);

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
    <section className="hidden space-y-6 border-t pt-6 md:block">
      <p className="text-muted-foreground/70 text-[11px] font-semibold tracking-wider uppercase">
        쿠팡 파일럿 (dormant)
      </p>

      {unassignedCount > 0 ? <UnassignedBanner count={unassignedCount} /> : null}

      <AlertsPanel />

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="오늘 배차" value={todayCount} hint="모든 상태 합계" />
        <KpiCard label="진행 중" value={progressResult.count ?? 0} tone="warning" hint="이동·도착·시공" />
        <KpiCard label="완료" value={completedResult.count ?? 0} tone="success" hint="시공·결제 완료" />
        <KpiCard
          label="미결제"
          value={unpaidResult.count ?? 0}
          tone={unpaidResult.count && unpaidResult.count > 0 ? 'warning' : 'default'}
          hint="결제 대기·발송"
        />
        <KpiCard
          label="이슈"
          value={issuesResult.count ?? 0}
          tone={issuesResult.count && issuesResult.count > 0 ? 'destructive' : 'default'}
          hint="현장 보고"
        />
        <KpiCard
          label="취소"
          value={cancelledResult.count ?? 0}
          tone={cancelledResult.count && cancelledResult.count > 0 ? 'destructive' : 'default'}
          hint="요청·확정 합계"
        />
      </div>

      <TechnicianBars max={technicianMax} stats={technicianStats} />
    </section>
  );
}
