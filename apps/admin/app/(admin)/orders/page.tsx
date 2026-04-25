import { getServerClient } from '@mount/db';
import { ForbiddenError, RedirectError, requireRole } from '@mount/lib';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@mount/ui';
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

const TIME_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Seoul',
});

export default async function OrdersPage(): Promise<ReactElement> {
  try {
    await requireRole(['admin']);
  } catch (error) {
    if (error instanceof RedirectError) redirect('/login?redirect=/orders');
    if (error instanceof ForbiddenError) redirect('/login?error=forbidden');
    throw error;
  }

  const client = await getServerClient();
  const { data } = await client
    .from('v_orders_dashboard')
    .select('id, status, scheduled_installation_at, technician_name, address_region_sigungu, tv_display, last_payment_status')
    .order('scheduled_installation_at', { ascending: false, nullsFirst: false })
    .limit(100);

  const orders = data ?? [];

  return (
    <AdminShell activeNav="orders" title="Orders">
      <div className="mx-auto max-w-screen-2xl space-y-6 px-6 py-6">
        <header className="flex items-baseline justify-between">
          <h2 className="text-2xl font-bold">전체 주문</h2>
          <p className="text-muted-foreground text-sm">최근 100건 (필터·정렬 R5 추가 예정)</p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">주문 목록</CardTitle>
          </CardHeader>
          <CardContent>
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
                        <td className="py-2">{order.technician_name ?? <span className="text-muted-foreground">미배차</span>}</td>
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
      </div>
    </AdminShell>
  );
}
