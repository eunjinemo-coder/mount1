import { getServerClient } from '@mount/db';
import { ForbiddenError, RedirectError, requireRole } from '@mount/lib';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@mount/ui';
import {
  AlertTriangle,
  ChevronLeft,
  FileText,
  MapPin,
  Navigation,
  Phone,
  PhoneCall,
  Tv,
} from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import { IssueForm } from './_components/issue-form';
import { ScheduleEditModal } from './_components/schedule-edit-modal';

export const metadata = { title: '주문 상세' };

type Tab = 'overview' | 'issues';

const TABS: { id: Tab; label: string; icon: typeof FileText }[] = [
  { id: 'overview', label: '개요', icon: FileText },
  { id: 'issues', label: '이슈', icon: AlertTriangle },
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
          .select('phone_tail4, address_region_sido, address_region_sigungu, address_lat, address_lng')
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
      .select('id, category, note, reported_at, admin_response_text, admin_response_at')
      .eq('order_id', orderId)
      .order('reported_at', { ascending: false })
      .limit(10),
  ]);

  const customer = customerResult.data;
  const photos = photosResult.data ?? [];
  const callLogs = callLogsResult.data ?? [];
  // admin_response_text / admin_response_at added by migration 0017 — not yet in generated types
  const issues = (issuesResult.data ?? []) as unknown as {
    id: string;
    category: string;
    note: string | null;
    reported_at: string | null;
    admin_response_text: string | null;
    admin_response_at: string | null;
  }[];

  const preCount = photos.filter((p) => ['pre_tv_screen', 'pre_wall'].includes(p.slot)).length;
  const postCount = photos.filter((p) =>
    ['post_front', 'post_left', 'post_right'].includes(p.slot),
  ).length;
  // CONTEXT.md: 사전통화 = 시도 행위. outcome (no_answer/busy/etc) 무관 — 시도 기록 자체가 의미.
  const preCallDone = callLogs.some((c) => c.type === 'pre_arrival_30min');
  const region = [customer?.address_region_sido, customer?.address_region_sigungu]
    .filter(Boolean)
    .join(' ');
  const phoneTail4 = customer?.phone_tail4 ?? '';
  const addressLat = customer?.address_lat ?? null;
  const addressLng = customer?.address_lng ?? null;
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
            const count = tab.id === 'issues' ? issues.length : 0;
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
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">예약 시각</CardTitle>
                <ScheduleEditModal
                  orderId={order.id}
                  currentScheduledAt={order.scheduled_installation_at}
                  status={order.status}
                />
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
                <div className="flex items-center justify-between gap-2">
                  <p className="text-base">{region || '주소 정보 없음'}</p>
                  {region ? (
                    <Link
                      aria-label="카카오 네비"
                      className="hover:text-foreground text-muted-foreground"
                      href={
                        addressLat !== null && addressLng !== null
                          ? // 카카오 네비 — coord_type=wgs84 명시 (기본은 KATEC 좌표계라 좌표 잘못 해석됨).
                            // 표준 위경도(WGS84)로 보내려면 반드시 명시.
                            `kakaonavi://navigate?coord_type=wgs84&dest_x=${addressLng}&dest_y=${addressLat}&dest_name=${encodeURIComponent(region)}`
                          : `kakaomap://search?q=${encodeURIComponent(region)}`
                      }
                    >
                      <Navigation className="size-5" />
                    </Link>
                  ) : null}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-muted-foreground flex items-center gap-2 text-sm">
                    <Phone className="size-4" />
                    ***-****-{phoneTail4 || '????'}
                  </p>
                  <Link
                    aria-label="사전 통화"
                    className="hover:text-foreground text-muted-foreground"
                    href={`/order/${orderId}/pre-call`}
                  >
                    <PhoneCall className="size-5" />
                  </Link>
                </div>
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
        ) : (
          <div className="space-y-3">
            <IssueForm orderId={order.id} />
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">이슈 이력 ({issues.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {issues.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    보고된 이슈가 없습니다.
                  </p>
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
                        {issue.admin_response_text ? (
                          <div className="mt-2 rounded-md border-l-4 border-l-emerald-500 bg-emerald-50/50 px-2 py-1">
                            <p className="text-xs font-semibold text-emerald-700">
                              ✓ 본사 응답{' '}
                              {issue.admin_response_at
                                ? `(${SHORT_DATETIME.format(new Date(issue.admin_response_at))})`
                                : ''}
                            </p>
                            <p className="text-xs text-emerald-900">{issue.admin_response_text}</p>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </main>
  );
}

function ActionButtons({ orderId, status }: { orderId: string; status: string }): ReactElement {
  const COMPLETED_STATUSES = ['no_drill_completed', 'drill_converted_completed', 'paid', 'closed'];

  if (status === 'assigned') {
    return (
      <div>
        <Button asChild className="w-full" size="lg">
          <Link href={`/order/${orderId}/photos`}>완료</Link>
        </Button>
        <div className="border-t border-border mt-6 pt-4 text-center">
          <Link
            href={`/order/${orderId}/cancel`}
            className="text-destructive text-xs font-semibold hover:underline"
          >
            ⚠ 시공 취소 보고
          </Link>
          <p className="text-muted-foreground mt-1 text-[10px]">
            현장에서 시공 불가 시 — 본사 검수 후 처리
          </p>
        </div>
      </div>
    );
  }
  if (COMPLETED_STATUSES.includes(status)) {
    return (
      <p className="text-muted-foreground py-4 text-center text-sm">이 주문은 완료되었습니다.</p>
    );
  }
  return (
    <p className="text-muted-foreground py-4 text-center text-sm">
      이 주문은 v1 워크플로 상태입니다. 본사 카카오톡 채널로 문의.
    </p>
  );
}
