import { getServerClient } from '@mount/db';
import {
  ForbiddenError,
  IN_PROGRESS_ORDER_STATUSES,
  RedirectError,
  requireRole,
} from '@mount/lib';
import { Badge, Card, CardContent } from '@mount/ui';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import { parseVisitTimeMinutes } from '@/lib/sheets/visit-time';
import { AdminShell } from '../_layout/admin-shell';
import { AlertsPanel } from './alerts-panel';
import { AutoRefresh } from './auto-refresh';
import { KpiCard } from './kpi-card';
import { TechnicianBars } from './technician-bars';
import { UnassignedBanner } from './unassigned-banner';

export const metadata = { title: '오늘 운영 현황' };

const TIME_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Seoul',
});

const PROGRESS_STATUSES = IN_PROGRESS_ORDER_STATUSES;
// admin/today 의 "완료" 는 결제 흐름 포함 — driver 정산 그룹과 다른 의미라 page-local 유지.
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

// ── 본사 시공(installation_jobs) — 자사앱 우선 도메인 ─────────────────────────
const INSTALLATION_STATUS_LABEL: Record<string, string> = {
  scheduled: '예정',
  in_progress: '진행중',
  completed: '완료',
  cancelled: '취소',
};
const INSTALLATION_STATUS_VARIANT: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  scheduled: 'outline',
  in_progress: 'default',
  completed: 'secondary',
  cancelled: 'destructive',
};

/** KST 오늘 날짜(YYYY-MM-DD) — installation_jobs.scheduled_install_date(date) 비교용. */
function kstToday(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

interface TodayInstallationRow {
  id: string;
  visit_time: string | null;
  customer_name: string | null;
  address: string | null;
  address_detail: string | null;
  technician_name: string | null;
  install_type: string | null;
  status: string | null;
}

/**
 * 오늘(KST) 본사 시공 — 활성(예정/진행중)만, 방문시간순.
 * installation_jobs 는 generated types 미포함 → 국소 untyped 캐스팅(다른 페이지와 동일).
 * 0025 미적용 등 실패 시 빈 배열로 격하(대시보드 무손상).
 */
async function loadTodayInstallations(
  client: Awaited<ReturnType<typeof getServerClient>>,
  dateStr: string,
): Promise<TodayInstallationRow[]> {
  try {
    const { data } = await (
      client as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (
              c: string,
              v: string,
            ) => {
              in: (c: string, v: string[]) => PromiseLike<{ data: TodayInstallationRow[] | null }>;
            };
          };
        };
      }
    )
      .from('installation_jobs')
      .select(
        'id, visit_time, customer_name, address, address_detail, technician_name, install_type, status',
      )
      .eq('scheduled_install_date', dateStr)
      .in('status', ['scheduled', 'in_progress']);

    const rows = data ?? [];
    const sortKey = (r: TodayInstallationRow): number =>
      parseVisitTimeMinutes(r.visit_time ?? '') ?? Number.MAX_SAFE_INTEGER;
    return [...rows].sort((a, b) => sortKey(a) - sortKey(b));
  } catch {
    return [];
  }
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

  // 미결제: status in awaiting_payment | payment_sent (오늘)
  const unpaidQuery = client
    .from('v_orders_dashboard')
    .select('id', { count: 'exact', head: true })
    .in('status', ['awaiting_payment', 'payment_sent'])
    .gte('scheduled_installation_at', start)
    .lt('scheduled_installation_at', end);

  // 이슈: issues 테이블에서 오늘 신고건
  const issuesQuery = client
    .from('issues')
    .select('id', { count: 'exact', head: true })
    .gte('reported_at', start)
    .lt('reported_at', end);

  const [todayResult, progressResult, completedResult, cancelledResult, unpaidResult, issuesResult] =
    await Promise.all([
      todayQuery,
      progressQuery,
      completedQuery,
      cancelledQuery,
      unpaidQuery,
      issuesQuery,
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

  const todayInstallations = await loadTodayInstallations(client, kstToday());

  return (
    <AdminShell activeNav="today" notificationCount={unassignedCount} title="오늘">
      <div className="mx-auto max-w-screen-2xl space-y-6 px-4 py-4 md:px-6 md:py-6">
        <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-2xl font-bold">오늘 운영 현황</h2>
          <div className="flex flex-col items-end gap-1 text-right">
            <p className="text-muted-foreground text-sm">기준 시각 {TIME_FORMATTER.format(new Date())}</p>
            <AutoRefresh />
          </div>
        </header>

        <TodayInstallations jobs={todayInstallations} />

        {/* 쿠팡 파일럿(dormant) — 모바일(기사 동선)에선 숨김: 죽은 KPI 6장이 스크롤만 차지 */}
        <section className="hidden space-y-6 border-t pt-6 md:block">
          <p className="text-muted-foreground/70 text-[11px] font-semibold tracking-wider uppercase">
            쿠팡 파일럿 (dormant)
          </p>

          {unassignedCount > 0 ? <UnassignedBanner count={unassignedCount} /> : null}

          <AlertsPanel />

          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
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
      </div>
    </AdminShell>
  );
}

/** 오늘 본사 시공 리스트 — today 대시보드의 히어로 섹션(자사앱 우선). */
function TodayInstallations({ jobs }: { jobs: TodayInstallationRow[] }): ReactElement {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-lg font-semibold">
          오늘 본사 시공{' '}
          <span className="text-muted-foreground text-sm font-normal">({jobs.length})</span>
        </h3>
        <Link
          className="text-muted-foreground hover:text-foreground text-sm hover:underline"
          href="/installations"
        >
          전체 시공 →
        </Link>
      </div>
      {jobs.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-6 text-sm">
            오늘 예정된 본사 시공이 없습니다.{' '}
            <Link className="text-primary hover:underline" href="/installations/new">
              시공 등록 →
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 모바일: 카드 리스트(방문시간 크게 · 탭=상세). 표는 폰에서 가독 불가. */}
          <div className="divide-y rounded-md border md:hidden">
            {jobs.map((job) => (
              <Link
                className="active:bg-muted/40 flex items-center gap-3 p-3 transition-colors"
                href={`/installations/${job.id}`}
                key={job.id}
              >
                <div className="w-14 shrink-0 text-center">
                  <p className="text-base font-bold tabular-nums">{job.visit_time ?? '-'}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-medium">
                    <span className="truncate">{job.customer_name ?? '-'}</span>
                    <Badge variant={INSTALLATION_STATUS_VARIANT[job.status ?? ''] ?? 'outline'}>
                      {INSTALLATION_STATUS_LABEL[job.status ?? ''] ?? job.status ?? '-'}
                    </Badge>
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {[job.address, job.address_detail].filter(Boolean).join(' ') || '주소 미입력'}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {job.technician_name ?? '미배정'}
                    {job.install_type ? ` · ${job.install_type}` : ''}
                  </p>
                </div>
                <span aria-hidden className="text-muted-foreground text-sm">
                  →
                </span>
              </Link>
            ))}
          </div>

          {/* 데스크톱: 표 */}
          <Card className="hidden md:block">
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wider">
                    <th className="text-muted-foreground px-2 py-3 text-left font-semibold">방문시간</th>
                    <th className="text-muted-foreground px-2 py-3 text-left font-semibold">성함</th>
                    <th className="text-muted-foreground px-2 py-3 text-left font-semibold">주소</th>
                    <th className="text-muted-foreground px-2 py-3 text-left font-semibold">담당자</th>
                    <th className="text-muted-foreground px-2 py-3 text-left font-semibold">타입</th>
                    <th className="text-muted-foreground px-2 py-3 text-left font-semibold">상태</th>
                    <th className="px-2 py-3 text-right" />
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr
                      className="hover:bg-muted/40 border-b transition-colors last:border-0"
                      key={job.id}
                    >
                      <td className="px-2 py-3 font-medium whitespace-nowrap tabular-nums">
                        {job.visit_time ?? '-'}
                      </td>
                      <td className="px-2 py-3">{job.customer_name ?? '-'}</td>
                      <td className="text-muted-foreground max-w-xs truncate px-2 py-3">
                        {[job.address, job.address_detail].filter(Boolean).join(' ') || '-'}
                      </td>
                      <td className="px-2 py-3">
                        {job.technician_name ?? (
                          <span className="text-muted-foreground italic">미배정</span>
                        )}
                      </td>
                      <td className="text-muted-foreground px-2 py-3">{job.install_type ?? '-'}</td>
                      <td className="px-2 py-3">
                        <Badge variant={INSTALLATION_STATUS_VARIANT[job.status ?? ''] ?? 'outline'}>
                          {INSTALLATION_STATUS_LABEL[job.status ?? ''] ?? job.status ?? '-'}
                        </Badge>
                      </td>
                      <td className="px-2 py-3 text-right">
                        <Link
                          className="text-primary hover:bg-primary/5 inline-flex items-center rounded px-2 py-1 text-xs font-medium hover:underline"
                          href={`/installations/${job.id}`}
                        >
                          상세 →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
          </Card>
        </>
      )}
    </section>
  );
}
