import { getServerClient } from '@mount/db';
import { ForbiddenError, RedirectError, requireRole } from '@mount/lib';
import { Badge, Button, Card, CardContent } from '@mount/ui';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import { AdminShell } from '../_layout/admin-shell';

export const metadata = { title: 'Orders' };

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

const FILTER_GROUPS = [
  { id: 'all', label: '전체', statuses: null },
  { id: 'pending', label: '대기', statuses: ['received', 'happy_call_pending', 'happy_call_done'] },
  { id: 'scheduled', label: '예약', statuses: ['scheduled', 'assigned'] },
  { id: 'progress', label: '진행', statuses: ['en_route', 'on_site', 'in_progress'] },
  {
    id: 'completed',
    label: '완료',
    statuses: ['no_drill_completed', 'drill_converted_completed'],
  },
  { id: 'payment', label: '결제', statuses: ['awaiting_payment', 'payment_sent', 'paid'] },
  {
    id: 'cancelled',
    label: '취소',
    statuses: ['cancel_requested', 'cancel_confirmed_coupang_transfer'],
  },
  { id: 'closed', label: '마감', statuses: ['closed'] },
] as const;

const PAGE_SIZE = 25;

const TIME_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Seoul',
});

export default async function OrdersPage(props: {
  searchParams: Promise<{ filter?: string; page?: string }>;
}): Promise<ReactElement> {
  try {
    await requireRole(['admin']);
  } catch (error) {
    if (error instanceof RedirectError) redirect('/login?redirect=/orders');
    if (error instanceof ForbiddenError) redirect('/login?error=forbidden');
    throw error;
  }

  const { filter: filterParam, page: pageParam } = await props.searchParams;
  const activeFilter = FILTER_GROUPS.find((g) => g.id === filterParam) ?? FILTER_GROUPS[0]!;
  const page = Math.max(1, Number(pageParam ?? '1'));
  const offset = (page - 1) * PAGE_SIZE;

  const client = await getServerClient();
  let query = client
    .from('v_orders_dashboard')
    .select(
      'id, status, scheduled_installation_at, technician_name, address_region_sigungu, tv_display, last_payment_status',
      { count: 'exact' },
    )
    .order('scheduled_installation_at', { ascending: false, nullsFirst: false });

  if (activeFilter.statuses) {
    query = query.in('status', activeFilter.statuses);
  }

  query = query.range(offset, offset + PAGE_SIZE - 1);
  const { data, count } = await query;

  const orders = data ?? [];
  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const buildHref = (overrides: { filter?: string; page?: number }) => {
    const params = new URLSearchParams();
    const f = overrides.filter ?? activeFilter.id;
    if (f !== 'all') params.set('filter', f);
    if (overrides.page && overrides.page > 1) params.set('page', String(overrides.page));
    const qs = params.toString();
    return qs ? `/orders?${qs}` : '/orders';
  };

  return (
    <AdminShell activeNav="orders" title="Orders">
      <div className="mx-auto max-w-screen-2xl space-y-6 px-6 py-6">
        <header className="flex items-baseline justify-between">
          <h2 className="text-2xl font-bold">전체 주문</h2>
          <p className="text-muted-foreground text-sm">
            {activeFilter.label} {totalCount}건 · 페이지 {page}/{totalPages}
          </p>
        </header>

        <nav className="flex flex-wrap gap-2">
          {FILTER_GROUPS.map((group) => {
            const isActive = group.id === activeFilter.id;
            return (
              <Button
                asChild
                key={group.id}
                size="sm"
                variant={isActive ? 'default' : 'outline'}
              >
                <Link href={buildHref({ filter: group.id, page: 1 })}>{group.label}</Link>
              </Button>
            );
          })}
        </nav>

        <Card>
          <CardContent className="pt-6">
            {orders.length === 0 ? (
              <p className="text-muted-foreground text-sm">조회된 주문이 없습니다.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="py-2 text-left font-medium">시각</th>
                      <th className="py-2 text-left font-medium">지역</th>
                      <th className="py-2 text-left font-medium">TV</th>
                      <th className="py-2 text-left font-medium">기사</th>
                      <th className="py-2 text-left font-medium">상태</th>
                      <th className="py-2 text-left font-medium">결제</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr className="border-b last:border-0" key={order.id}>
                        <td className="py-2">
                          {order.scheduled_installation_at
                            ? TIME_FORMATTER.format(new Date(order.scheduled_installation_at))
                            : '미정'}
                        </td>
                        <td className="py-2">{order.address_region_sigungu ?? '-'}</td>
                        <td className="text-muted-foreground py-2">{order.tv_display ?? '-'}</td>
                        <td className="py-2">
                          {order.technician_name ?? (
                            <span className="text-muted-foreground">미배차</span>
                          )}
                        </td>
                        <td className="py-2">
                          <Badge variant="outline">
                            {STATUS_LABEL[order.status ?? ''] ?? order.status}
                          </Badge>
                        </td>
                        <td className="text-muted-foreground py-2 text-xs">
                          {order.last_payment_status ?? '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {totalPages > 1 ? (
          <div className="flex items-center justify-between text-sm">
            <Button asChild disabled={page <= 1} size="sm" variant="outline">
              <Link href={buildHref({ page: Math.max(1, page - 1) })}>← 이전</Link>
            </Button>
            <span className="text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button asChild disabled={page >= totalPages} size="sm" variant="outline">
              <Link href={buildHref({ page: Math.min(totalPages, page + 1) })}>다음 →</Link>
            </Button>
          </div>
        ) : null}
      </div>
    </AdminShell>
  );
}
