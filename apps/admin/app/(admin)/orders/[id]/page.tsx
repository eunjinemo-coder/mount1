import { getServerClient } from '@mount/db';
import { ForbiddenError, getSession, RedirectError, requireRole } from '@mount/lib';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@mount/ui';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import { AdminShell } from '../../_layout/admin-shell';
import { IssueResponseForm } from './_components/issue-response-form';
import { OrderMutateCard } from './order-mutate-card';

export const metadata = { title: '주문 상세' };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUS_LABEL: Record<string, string> = {
  received: '접수',
  happy_call_pending: '해피콜 대기',
  happy_call_done: '해피콜 완료',
  scheduled: '예약 확정',
  assigned: '배차 확정',
  en_route: '이동 중',
  on_site: '현장 도착',
  in_progress: '시공 중',
  no_drill_completed: '무타공 완료',
  drill_converted_completed: '타공 전환 완료',
  awaiting_payment: '결제 대기',
  payment_sent: '결제 발송',
  paid: '결제 완료',
  postponed: '연기',
  on_hold: '보류',
  cancel_requested: '취소 요청',
  cancel_confirmed_coupang_transfer: '취소 확정',
  closed: '마감',
};

const OPTION_LABEL: Record<string, string> = {
  A_stand: '스탠드',
  B_drill: '타공',
  C_no_drill: '무타공',
};

const DATETIME = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Seoul',
});

export default async function OrderDetailPage(props: {
  params: Promise<{ id: string }>;
}): Promise<ReactElement> {
  try {
    await requireRole(['admin']);
  } catch (error) {
    if (error instanceof RedirectError) redirect('/login?redirect=/orders');
    if (error instanceof ForbiddenError) redirect('/login?error=forbidden');
    throw error;
  }

  const { id } = await props.params;
  if (!UUID_RE.test(id)) notFound();

  const session = await getSession();
  const canMutate =
    !!session?.adminRole &&
    ['super_admin', 'cs_admin', 'dispatch_admin'].includes(session.adminRole);
  const canRespondIssue =
    !!session?.adminRole &&
    ['super_admin', 'cs_admin', 'ops_admin'].includes(session.adminRole);

  const client = await getServerClient();

  const { data: rawOrder } = await client
    .from('orders')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!rawOrder) notFound();

  const order = rawOrder as unknown as {
    id: string;
    coupang_order_id: string | null;
    order_received_at: string | null;
    tv_brand: string | null;
    tv_model: string | null;
    tv_size_inch: number | null;
    option_selected: string | null;
    scheduled_installation_at: string | null;
    status: string | null;
    assigned_technician_id: string | null;
    assigned_at: string | null;
    happy_call_result: string | null;
    wall_type: string | null;
    special_notes: string | null;
    conversion_from_no_drill: boolean | null;
    conversion_difference_amount: number | null;
  };

  // 보조 데이터 (모두 null/empty 안전)
  const [techRes, photosRes, issuesRes, callsRes, eventsRes] = await Promise.all([
    order.assigned_technician_id
      ? client
          .from('technicians')
          .select('id, display_name, phone, grade')
          .eq('id', order.assigned_technician_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    client.from('photos').select('id, slot, supabase_path, uploaded_at').eq('order_id', id),
    client.from('issues').select('id, category, note, reported_at, admin_response_text, admin_response_at').eq('order_id', id).order('reported_at', { ascending: false }),
    client.from('call_logs').select('id, type, call_outcome, called_at').eq('order_id', id).order('called_at', { ascending: false }),
    client
      .from('audit_events')
      .select('id, action, after_value, occurred_at')
      .eq('subject_type', 'order')
      .eq('subject_id', id)
      .order('occurred_at', { ascending: false })
      .limit(10),
  ]);

  const tech = (techRes as { data: { id: string; display_name: string; phone: string; grade: string } | null }).data;
  const photoCount = photosRes.data?.length ?? 0;
  // admin_response_text / admin_response_at / admin_responder_id added by migration 0017 — not yet in generated types
  const issues = (issuesRes.data ?? []) as unknown as {
    id: string;
    category: string;
    note: string | null;
    reported_at: string | null;
    admin_response_text: string | null;
    admin_response_at: string | null;
  }[];
  const calls = callsRes.data ?? [];
  const events = (eventsRes.data ?? []) as unknown as {
    id: string;
    action: string;
    after_value: Record<string, unknown> | null;
    occurred_at: string;
  }[];

  const tvDisplay = [order.tv_brand, order.tv_model, order.tv_size_inch ? `${order.tv_size_inch}형` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <AdminShell activeNav="orders" title={`주문 - ${id.slice(0, 8)}`}>
      <div className="mx-auto max-w-screen-xl space-y-6 px-6 py-6">
        <header className="flex items-baseline justify-between">
          <div>
            <Link className="text-muted-foreground text-sm hover:underline" href="/orders">
              ← 주문 목록
            </Link>
            <h2 className="text-2xl font-bold">주문 상세</h2>
            <p className="text-muted-foreground font-mono text-sm">{id}</p>
            <p className="text-muted-foreground text-sm">
              쿠팡 ID: {order.coupang_order_id ?? '-'}
            </p>
          </div>
          <Badge variant="outline" className="text-sm">
            {STATUS_LABEL[order.status ?? ''] ?? order.status}
          </Badge>
        </header>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">기본 정보</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm md:grid-cols-2">
                <Field label="TV" value={tvDisplay || '-'} />
                <Field
                  label="옵션"
                  value={OPTION_LABEL[order.option_selected ?? ''] ?? order.option_selected ?? '-'}
                />
                <Field
                  label="시공 시각"
                  value={
                    order.scheduled_installation_at
                      ? DATETIME.format(new Date(order.scheduled_installation_at))
                      : '미정'
                  }
                />
                <Field
                  label="접수 시각"
                  value={
                    order.order_received_at
                      ? DATETIME.format(new Date(order.order_received_at))
                      : '-'
                  }
                />
                <Field label="해피콜 결과" value={order.happy_call_result ?? '-'} />
                <Field label="벽 타입" value={order.wall_type ?? '-'} />
                <Field
                  label="전환 여부"
                  value={
                    order.conversion_from_no_drill
                      ? `전환 (+${(order.conversion_difference_amount ?? 0).toLocaleString('ko-KR')}원)`
                      : '없음'
                  }
                />
                <Field
                  label="배차 시각"
                  value={
                    order.assigned_at ? DATETIME.format(new Date(order.assigned_at)) : '-'
                  }
                />
                {order.special_notes ? (
                  <Field label="특이사항" value={order.special_notes} span2 />
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">담당 기사</CardTitle>
              </CardHeader>
              <CardContent>
                {tech ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{tech.display_name}</p>
                      <p className="text-muted-foreground text-xs">
                        {tech.grade} · ***-****-{tech.phone.slice(-4)}
                      </p>
                    </div>
                    <Link
                      className="text-primary text-xs hover:underline"
                      href={`/technicians/${tech.id}`}
                    >
                      기사 상세 →
                    </Link>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">미배차</p>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-3 gap-4">
              <Stat label="사진" value={photoCount} />
              <Stat label="이슈" value={issues.length} />
              <Stat label="통화" value={calls.length} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">최근 이력 (최대 10개)</CardTitle>
              </CardHeader>
              <CardContent>
                {events.length === 0 ? (
                  <p className="text-muted-foreground text-sm">기록 없음</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {events.map((e) => (
                      <li key={e.id} className="flex items-baseline justify-between gap-2 border-b pb-2 last:border-0">
                        <div className="min-w-0">
                          <p className="font-medium">{e.action}</p>
                          {e.after_value ? (
                            <p className="text-muted-foreground truncate font-mono text-xs">
                              {JSON.stringify(e.after_value)}
                            </p>
                          ) : null}
                        </div>
                        <span className="text-muted-foreground text-xs whitespace-nowrap">
                          {DATETIME.format(new Date(e.occurred_at))}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">이슈 ({issues.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {issues.length === 0 ? (
                  <p className="text-muted-foreground text-sm">보고된 이슈 없음</p>
                ) : (
                  <ul className="space-y-4 text-sm">
                    {issues.map((issue) => (
                      <li key={issue.id} className="rounded-md border p-3">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline">{issue.category}</Badge>
                          <span className="text-muted-foreground text-xs">
                            {issue.reported_at
                              ? DATETIME.format(new Date(issue.reported_at))
                              : '-'}
                          </span>
                        </div>
                        {issue.note ? (
                          <p className="text-muted-foreground mt-1 text-xs">{issue.note}</p>
                        ) : null}
                        {issue.admin_response_text ? (
                          <div className="mt-2 rounded-md border-l-4 border-l-emerald-500 bg-emerald-50/50 px-2 py-1">
                            <p className="text-xs font-semibold text-emerald-700">
                              ✓ 응답됨{' '}
                              {issue.admin_response_at
                                ? `(${DATETIME.format(new Date(issue.admin_response_at))})`
                                : ''}
                            </p>
                            <p className="text-xs text-emerald-900">{issue.admin_response_text}</p>
                          </div>
                        ) : canRespondIssue ? (
                          <IssueResponseForm issueId={issue.id} orderId={id} />
                        ) : (
                          <p className="text-muted-foreground mt-1 text-xs">미응답 (응답 권한 없음)</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <div>
            {canMutate ? (
              <OrderMutateCard
                orderId={id}
                currentStatus={order.status ?? ''}
                currentScheduledAt={order.scheduled_installation_at}
              />
            ) : (
              <Card>
                <CardContent className="text-muted-foreground py-6 text-sm">
                  수동 변경 권한 없음 (감사 모드).
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

function Field({ label, value, span2 }: { label: string; value: string; span2?: boolean }): ReactElement {
  return (
    <div className={span2 ? 'md:col-span-2' : ''}>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }): ReactElement {
  return (
    <Card>
      <CardContent className="py-4 text-center">
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-muted-foreground text-xs">{label}</p>
      </CardContent>
    </Card>
  );
}
