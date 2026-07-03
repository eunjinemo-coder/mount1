import { getServerClient } from '@mount/db';
import { ForbiddenError, RedirectError, requireRole } from '@mount/lib';
import { Badge, Button, Card, CardContent } from '@mount/ui';
import { AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import { AdminShell } from '../../_layout/admin-shell';
import { safeCount, safeSelect, storeClient } from '../_lib/shared';
import { formatDateTime, formatWon, ORDER_STATUS_LABEL } from '../_lib/labels';
import { OrderRowActions } from './order-row-actions';

export const metadata = { title: '스토어 주문 목록' };

interface OrderRow {
  id: string;
  order_no: string;
  status: string;
  buyer_name: string;
  buyer_company: string | null;
  buyer_phone_tail4: string;
  depositor_name: string | null;
  total_amount: number;
  created_at: string;
}

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
  searchParams: Promise<{ filter?: string }>;
}): Promise<ReactElement> {
  try {
    await requireRole({ adminRoles: ['super_admin', 'ops_admin', 'auditor'] });
  } catch (error) {
    if (error instanceof RedirectError) redirect('/login?redirect=/store/orders');
    if (error instanceof ForbiddenError) redirect('/login?error=forbidden');
    throw error;
  }

  const { filter: filterParam } = await props.searchParams;
  const activeFilter = FILTER_GROUPS.find((g) => g.id === filterParam) ?? FILTER_GROUPS[0];

  const client = storeClient(await getServerClient());

  let query = client
    .from('store_orders')
    .select(
      'id, order_no, status, buyer_name, buyer_company, buyer_phone_tail4, depositor_name, total_amount, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);

  if (activeFilter.statuses) {
    query = query.in('status', activeFilter.statuses as unknown as string[]);
  }

  const ordersData = await safeSelect<OrderRow[]>(query);
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
              {activeFilter.label} {orders.length}건 (최근 {PAGE_SIZE}건)
            </p>
          </div>
          {failedCount > 0 ? (
            <span className="bg-destructive/10 text-destructive flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium">
              <AlertCircle className="size-3" aria-hidden />
              발송 실패 {failedCount}건
            </span>
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
                      <th className="text-muted-foreground px-2 py-3 text-left font-semibold">입금자명</th>
                      <th className="text-muted-foreground px-2 py-3 text-left font-semibold">금액</th>
                      <th className="text-muted-foreground px-2 py-3 text-left font-semibold">상태</th>
                      <th className="px-2 py-3 text-right" />
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr className="hover:bg-muted/40 border-b transition-colors last:border-0" key={o.id}>
                        <td className="px-2 py-3 font-mono text-xs font-medium">{o.order_no}</td>
                        <td className="text-muted-foreground px-2 py-3 tabular-nums">
                          {formatDateTime(o.created_at)}
                        </td>
                        <td className="px-2 py-3">
                          {o.buyer_name}
                          {o.buyer_company ? (
                            <span className="text-muted-foreground"> · {o.buyer_company}</span>
                          ) : null}
                          <p className="text-muted-foreground text-xs">***-****-{o.buyer_phone_tail4}</p>
                        </td>
                        <td className="px-2 py-3">{o.depositor_name ?? '-'}</td>
                        <td className="px-2 py-3 font-medium tabular-nums">{formatWon(o.total_amount)}</td>
                        <td className="px-2 py-3">
                          <Badge variant="outline">{ORDER_STATUS_LABEL[o.status] ?? o.status}</Badge>
                        </td>
                        <td className="px-2 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <OrderRowActions orderId={o.id} status={o.status} />
                            <Link
                              className="text-primary hover:bg-primary/5 inline-flex items-center rounded px-2 py-1 text-xs font-medium hover:underline"
                              href={`/store/orders/${o.id}`}
                            >
                              상세 →
                            </Link>
                          </div>
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
