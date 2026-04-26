import { getServerClient } from '@mount/db';
import { ForbiddenError, RedirectError, requireRole } from '@mount/lib';
import { Button, Card, CardContent } from '@mount/ui';
import { Layers, List, MapPin } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import { DriverShell } from '../_layout/driver-shell';
import { EmptyState } from './empty-state';
import { OrderCard } from './order-card';

export const metadata = { title: '오늘의 시공' };

type Tab = 'realtime' | 'batch' | 'map';

const TABS: { id: Tab; label: string; icon: typeof List }[] = [
  { id: 'realtime', label: '실시간', icon: List },
  { id: 'batch', label: '일괄 처리', icon: Layers },
  { id: 'map', label: '지도', icon: MapPin },
];

const DATE_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'short',
  timeZone: 'Asia/Seoul',
});

export default async function TodayPage(props: {
  searchParams: Promise<{ tab?: string }>;
}): Promise<ReactElement> {
  const { tab: tabParam } = await props.searchParams;
  const activeTab: Tab = (TABS.find((t) => t.id === tabParam)?.id ?? 'realtime') as Tab;

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
    <DriverShell technicianName={technicianName}>
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

        <nav className="bg-muted mb-4 flex gap-1 rounded-md p-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <Button
                asChild
                className="flex-1"
                key={tab.id}
                size="sm"
                variant={isActive ? 'default' : 'ghost'}
              >
                <Link href={tab.id === 'realtime' ? '/today' : `/today?tab=${tab.id}`}>
                  <Icon className="size-4" />
                  {tab.label}
                </Link>
              </Button>
            );
          })}
        </nav>

        {activeTab === 'realtime' ? (
          orders.length === 0 ? (
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
          )
        ) : activeTab === 'batch' ? (
          <Card>
            <CardContent className="space-y-2 py-6 text-center text-sm">
              <p className="font-semibold">일괄 처리 (R8 예정)</p>
              <p className="text-muted-foreground">
                현장에서 입력이 어려운 경우 하루 끝에 몰아서 결과를 입력하는 모드.
                현재는 실시간 탭에서 각 카드 클릭으로 처리해 주세요.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="space-y-3 py-6 text-center text-sm">
              <MapPin className="text-muted-foreground mx-auto size-8" />
              <p className="font-semibold">지도 뷰 (R8 Kakao Maps SDK 도입 예정)</p>
              <p className="text-muted-foreground">
                {orders.length}건의 시공 위치를 지도에 표시. 핀 번호는 시각 오름차순(rev 4).
                <br />
                현재 오늘 배차 좌표 기반 핀:
              </p>
              {orders.length > 0 ? (
                <ul className="text-muted-foreground space-y-1 text-left text-xs">
                  {orders.slice(0, 10).map((o, idx) => (
                    <li key={o.order_id ?? idx}>
                      {idx + 1}. {o.region ?? '-'} · {o.tv ?? '-'}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">오늘 배차 없음</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DriverShell>
  );
}
