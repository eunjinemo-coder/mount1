import { getServerClient } from '@mount/db';
import { ForbiddenError, RedirectError, requireRole } from '@mount/lib';
import { Button, Card, CardContent } from '@mount/ui';
import { AlertCircle, X } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import { AdminShell } from '../../_layout/admin-shell';
import { safeCount, safeSelect, storeClient } from '../_lib/shared';
import { OrderRow, type OrderListRow } from './order-row';

export const metadata = { title: '스토어 주문 목록' };

const ORDER_LIST_COLUMNS =
  'id, order_no, status, buyer_name, buyer_company, buyer_phone_tail4, depositor_name, total_amount, created_at';

const FILTER_GROUPS = [
  { id: 'awaiting_payment', label: '입금대기', statuses: ['awaiting_payment'] },
  { id: 'all', label: '전체', statuses: null },
  { id: 'paid', label: '결제완료', statuses: ['paid'] },
  { id: 'preparing', label: '배송준비', statuses: ['preparing'] },
  { id: 'shipped', label: '배송중', statuses: ['shipped'] },
  { id: 'delivered', label: '배송완료', statuses: ['delivered'] },
  { id: 'cancelled', label: '취소/만료', statuses: ['cancelled', 'expired'] },
] as const;

const PAGE_SIZE = 25;

export default async function StoreOrdersPage(props: {
  searchParams: Promise<{ filter?: string; failed?: string }>;
}): Promise<ReactElement> {
  try {
    await requireRole({ adminRoles: ['super_admin', 'ops_admin', 'auditor'] });
  } catch (error) {
    if (error instanceof RedirectError) redirect('/login?redirect=/store/orders');
    if (error instanceof ForbiddenError) redirect('/login?error=forbidden');
    throw error;
  }

  const { filter: filterParam, failed: failedParam } = await props.searchParams;
  const activeFilter = FILTER_GROUPS.find((g) => g.id === filterParam) ?? FILTER_GROUPS[0];
  const showFailedOnly = failedParam === '1';

  const client = storeClient(await getServerClient());

  // 발송 실패 필터(팀리드 지시 §5): store_message_log!inner 로 embedded filter —
  // 상태 필터와 무관하게 실패 로그가 달린 주문만 보여준다(어느 상태에서든 실패할 수 있음).
  let query = showFailedOnly
    ? client
        .from('store_orders')
        .select(`${ORDER_LIST_COLUMNS}, store_message_log!inner(status, attempts)`)
        .eq('store_message_log.status', 'failed')
        .gte('store_message_log.attempts', 3)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE)
    : client.from('store_orders').select(ORDER_LIST_COLUMNS).order('created_at', { ascending: false }).limit(PAGE_SIZE);

  if (!showFailedOnly && activeFilter.statuses) {
    query = query.in('status', activeFilter.statuses as unknown as string[]);
  }

  const ordersData = await safeSelect<OrderListRow[]>(query);
  const orders = ordersData ?? [];

  const failedCount = await safeCount(
    client
      .from('store_message_log')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('attempts', 3),
  );

  return (
    <AdminShell activeNav="storeOrders" title="스토어 주문">
      <div className="mx-auto max-w-screen-2xl space-y-6 px-6 py-6">
        <header className="flex items-baseline justify-between">
          <div>
            <h2 className="text-2xl font-bold">스토어 주문</h2>
            <p className="text-muted-foreground text-sm">
              {showFailedOnly ? '발송 실패' : activeFilter.label} {orders.length}건
              {showFailedOnly ? '' : ` (최근 ${PAGE_SIZE}건)`}
            </p>
          </div>
          {showFailedOnly ? (
            <Link
              className="bg-destructive/10 text-destructive flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium hover:underline"
              href="/store/orders"
            >
              <X className="size-3" aria-hidden />
              발송 실패 필터 해제
            </Link>
          ) : failedCount > 0 ? (
            <Link
              className="bg-destructive/10 text-destructive flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium hover:underline"
              href="/store/orders?failed=1"
            >
              <AlertCircle className="size-3" aria-hidden />
              발송 실패 {failedCount}건
            </Link>
          ) : null}
        </header>

        <nav className="flex flex-wrap gap-2">
          {FILTER_GROUPS.map((group) => {
            const isActive = group.id === activeFilter.id;
            const href = group.id === 'awaiting_payment' ? '/store/orders' : `/store/orders?filter=${group.id}`;
            return (
              <Button asChild key={group.id} size="sm" variant={isActive ? 'default' : 'outline'}>
                <Link href={href}>{group.label}</Link>
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
                    <tr className="border-b text-xs uppercase tracking-wider">
                      <th className="text-muted-foreground px-2 py-3 text-left font-semibold">주문번호</th>
                      <th className="text-muted-foreground px-2 py-3 text-left font-semibold">일시</th>
                      <th className="text-muted-foreground px-2 py-3 text-left font-semibold">주문자/상호</th>
                      <th className="text-muted-foreground px-2 py-3 text-left font-semibold">입금자명 · 금액</th>
                      <th className="text-muted-foreground px-2 py-3 text-left font-semibold">상태</th>
                      <th className="px-2 py-3 text-right" />
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <OrderRow key={o.id} order={o} />
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
