import { getServerClient } from '@mount/db';
import { ForbiddenError, RedirectError, requireRole } from '@mount/lib';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@mount/ui';
import {
  AlertTriangle,
  Camera,
  ChevronLeft,
  FileText,
  MapPin,
  Phone,
  PhoneCall,
  Tv,
} from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { ReactElement } from 'react';

export const metadata = { title: '주문 상세' };

type Tab = 'overview' | 'photos' | 'issues' | 'calls';

const TABS: { id: Tab; label: string; icon: typeof FileText }[] = [
  { id: 'overview', label: '개요', icon: FileText },
  { id: 'photos', label: '사진', icon: Camera },
  { id: 'issues', label: '이슈', icon: AlertTriangle },
  { id: 'calls', label: '통화', icon: PhoneCall },
];

const DATETIME_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Seoul',
});

const SHORT_DATETIME = new Intl.DateTimeFormat('ko-KR', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Seoul',
});

const STATUS_LABEL: Record<string, string> = {
  assigned: '배차 확정',
  en_route: '이동 중',
  on_site: '현장 도착',
  in_progress: '시공 중',
  no_drill_completed: '무타공 완료',
  drill_converted_completed: '타공 전환 완료',
};

const OPTION_LABEL: Record<string, string> = {
  A_stand: '스탠드',
  B_drill: '벽걸이 (타공)',
  C_no_drill: '벽걸이 (무타공)',
};

const CALL_OUTCOME_LABEL: Record<string, string> = {
  answered: '통화 완료',
  no_answer: '부재중',
  busy: '통화 중',
  unreachable: '연결 안됨',
  manual_marked_done: '수동 완료',
  customer_postponed: '고객 연기',
  customer_cancelled: '고객 취소',
};

const ISSUE_CATEGORY_LABEL: Record<string, string> = {
  no_drill_impossible: '무타공 불가',
  customer_absent: '고객 부재',
  address_inaccessible: '접근 불가',
  tv_model_mismatch: 'TV 불일치',
  wall_damage_found: '벽면 손상',
  etc: '기타',
};

export default async function OrderDetailPage(props: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ tab?: string }>;
}): Promise<ReactElement> {
  const [{ orderId }, { tab: tabParam }] = await Promise.all([props.params, props.searchParams]);
  const activeTab: Tab = (TABS.find((t) => t.id === tabParam)?.id ?? 'overview') as Tab;

  try {
    await requireRole(['technician']);
  } catch (error) {
    if (error instanceof RedirectError) {
      redirect(`/login?redirect=${encodeURIComponent(`/order/${orderId}`)}`);
    }
    if (error instanceof ForbiddenError) redirect('/login?error=forbidden');
    throw error;
  }

  const client = await getServerClient();

  const orderResult = await client
    .from('orders')
    .select(
      'id, status, scheduled_installation_at, tv_brand, tv_model, tv_size_inch, option_selected, conversion_from_no_drill, customer_id',
    )
    .eq('id', orderId)
    .maybeSingle();

  const order = orderResult.data;
  if (!order) notFound();

  const [customerResult, photosResult, callLogsResult, issuesResult] = await Promise.all([
    order.customer_id
      ? client
          .from('v_customer_for_technician')
          .select('*')
          .eq('id', order.customer_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    client.from('photos').select('slot, uploaded_at').eq('order_id', orderId),
    client
      .from('call_logs')
      .select('id, type, called_at, call_outcome, call_duration_seconds')
      .eq('order_id', orderId)
      .order('called_at', { ascending: false })
      .limit(20),
    client
      .from('issues')
      .select('id, category, note, reported_at')
      .eq('order_id', orderId)
      .order('reported_at', { ascending: false })
      .limit(10),
  ]);

  const customer = customerResult.data;
  const photos = photosResult.data ?? [];
  const callLogs = callLogsResult.data ?? [];
  const issues = issuesResult.data ?? [];

  const preCount = photos.filter((p) => ['pre_tv_screen', 'pre_wall'].includes(p.slot)).length;
  const postCount = photos.filter((p) =>
    ['post_front', 'post_left', 'post_right'].includes(p.slot),
  ).length;
  const preCallDone = callLogs.some(
    (c) =>
      c.type === 'pre_arrival_30min' &&
      ['answered', 'manual_marked_done'].includes(c.call_outcome ?? ''),
  );
  const region = [customer?.address_region_sido, customer?.address_region_sigungu]
    .filter(Boolean)
    .join(' ');
  const phoneTail4 = customer?.phone_tail4 ?? '';
  const scheduled = order.scheduled_installation_at
    ? DATETIME_FORMATTER.format(new Date(order.scheduled_installation_at))
    : '시간 미정';
  const tvDisplay = `${order.tv_brand ?? ''} ${order.tv_model ?? ''} ${order.tv_size_inch ? `(${order.tv_size_inch}")` : ''}`.trim();
  const optionLabel = OPTION_LABEL[order.option_selected] ?? order.option_selected;

  return (
    <main className="bg-background safe-top safe-bottom min-h-dvh px-4 py-4">
      <div className="mx-auto max-w-screen-md space-y-4">
        <header className="flex items-center justify-between">
          <Button asChild size="sm" variant="ghost">
            <Link href="/today">
              <ChevronLeft className="size-4" />
              오늘 시공
            </Link>
          </Button>
          <Badge variant="secondary">{STATUS_LABEL[order.status] ?? order.status}</Badge>
        </header>

        <h1 className="text-2xl font-bold">주문 상세</h1>

        <nav className="bg-muted flex gap-1 rounded-md p-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const count =
              tab.id === 'photos'
                ? photos.length
                : tab.id === 'issues'
                  ? issues.length
                  : tab.id === 'calls'
                    ? callLogs.length
                    : 0;
            return (
              <Button
                asChild
                className="flex-1"
                key={tab.id}
                size="sm"
                variant={isActive ? 'default' : 'ghost'}
              >
                <Link
                  href={tab.id === 'overview' ? `/order/${orderId}` : `/order/${orderId}?tab=${tab.id}`}
                >
                  <Icon className="size-4" />
                  {tab.label}
                  {count > 0 ? (
                    <span className="bg-background/80 text-foreground rounded-full px-1.5 text-xs">
                      {count}
                    </span>
                  ) : null}
                </Link>
              </Button>
            );
          })}
        </nav>

        {activeTab === 'overview' ? (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">예약 시각</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">{scheduled}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <MapPin className="size-4" />
                  고객
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-base">{region || '주소 정보 없음'}</p>
                <p className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Phone className="size-4" />
                  ***-****-{phoneTail4 || '????'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Tv className="size-4" />
                  TV
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-base">{tvDisplay || 'TV 정보 없음'}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">진행 현황</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">사전 통화</span>
                  <span className={preCallDone ? 'text-success font-medium' : 'text-destructive'}>
                    {preCallDone ? '✓ 완료' : '미완료'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">시공 전 사진 (필수 2장)</span>
                  <span className={preCount >= 2 ? 'text-success font-medium' : 'text-destructive'}>
                    {preCount}/2
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">완료 사진 (필수 3장)</span>
                  <span
                    className={postCount >= 3 ? 'text-success font-medium' : 'text-muted-foreground'}
                  >
                    {postCount}/3
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">시공 옵션</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">선택 옵션</span>
                  <span className="font-medium">{optionLabel}</span>
                </div>
                <p className="text-muted-foreground text-xs leading-5">
                  결제 정보는 본사·고객 화면에서만 표시됩니다. 타공 전환 시 차액은 본사가 자동 청구합니다.
                </p>
              </CardContent>
            </Card>

            <ActionButtons orderId={order.id} status={order.status} />
          </>
        ) : activeTab === 'photos' ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">사진 ({photos.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">시공 전 (필수 2장)</span>
                <span className={preCount >= 2 ? 'text-success' : 'text-destructive'}>
                  {preCount}/2
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">완료 (필수 3장)</span>
                <span className={postCount >= 3 ? 'text-success' : 'text-muted-foreground'}>
                  {postCount}/3
                </span>
              </div>
              <Button asChild className="w-full" size="lg">
                <Link href={`/order/${orderId}/photos`}>사진 업로드 화면 열기</Link>
              </Button>
            </CardContent>
          </Card>
        ) : activeTab === 'issues' ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">이슈 ({issues.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {issues.length === 0 ? (
                <p className="text-muted-foreground text-sm">이 주문에 보고된 이슈가 없습니다.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {issues.map((issue) => (
                    <li className="rounded-md border p-3" key={issue.id}>
                      <div className="flex items-center justify-between">
                        <Badge variant="outline">
                          {ISSUE_CATEGORY_LABEL[issue.category] ?? issue.category}
                        </Badge>
                        <span className="text-muted-foreground text-xs">
                          {issue.reported_at
                            ? SHORT_DATETIME.format(new Date(issue.reported_at))
                            : '-'}
                        </span>
                      </div>
                      {issue.note ? (
                        <p className="text-muted-foreground mt-1 text-xs">{issue.note}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-muted-foreground text-xs">
                * 신규 이슈 신고는 R8 작업에서 추가 예정. 긴급 시 본사 카카오톡 채널.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">통화 기록 ({callLogs.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {callLogs.length === 0 ? (
                <p className="text-muted-foreground text-sm">통화 기록이 없습니다.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {callLogs.map((log) => (
                    <li className="rounded-md border p-3" key={log.id}>
                      <div className="flex items-center justify-between">
                        <Badge variant="outline">
                          {CALL_OUTCOME_LABEL[log.call_outcome ?? ''] ?? log.call_outcome ?? '-'}
                        </Badge>
                        <span className="text-muted-foreground text-xs">
                          {log.called_at
                            ? SHORT_DATETIME.format(new Date(log.called_at))
                            : '-'}
                        </span>
                      </div>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {log.type === 'pre_arrival_30min'
                          ? '30분 전'
                          : log.type === 'post_arrival'
                            ? '도착 후'
                            : '수동'}
                        {log.call_duration_seconds ? ` · ${log.call_duration_seconds}s` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <Button asChild className="w-full" size="lg" variant="outline">
                <Link href={`/order/${orderId}/pre-call`}>30분 전 통화 기록 추가</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}

function ActionButtons({ orderId, status }: { orderId: string; status: string }): ReactElement {
  if (status === 'assigned' || status === 'en_route') {
    return (
      <div className="grid gap-3">
        <Button asChild className="w-full" size="lg">
          <Link href={`/order/${orderId}/start`}>
            {status === 'assigned' ? '출발' : '현장 도착'}
          </Link>
        </Button>
        <Button asChild className="w-full" size="lg" variant="outline">
          <Link href={`/order/${orderId}/pre-call`}>30분 전 통화 기록</Link>
        </Button>
      </div>
    );
  }
  if (status === 'on_site') {
    return (
      <div className="grid gap-3">
        <Button asChild className="w-full" size="lg">
          <Link href={`/order/${orderId}/start`}>시공 시작</Link>
        </Button>
        <Button asChild className="w-full" size="lg" variant="outline">
          <Link href={`/order/${orderId}/cancel`}>취소 리포트</Link>
        </Button>
      </div>
    );
  }
  if (status === 'in_progress') {
    return (
      <div className="grid gap-3">
        <Button asChild className="w-full" size="lg">
          <Link href={`/order/${orderId}/complete`}>시공 완료</Link>
        </Button>
        <Button asChild className="w-full" size="lg" variant="outline">
          <Link href={`/order/${orderId}/photos`}>사진 업로드</Link>
        </Button>
      </div>
    );
  }
  return (
    <p className="text-muted-foreground py-4 text-center text-sm">
      현재 상태에서는 진행할 액션이 없어요.
    </p>
  );
}
