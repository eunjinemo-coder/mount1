import { getServerClient } from '@mount/db';
import { ForbiddenError, getSession, isValidUuid, RedirectError, requireRole } from '@mount/lib';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@mount/ui';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import { AdminShell } from '../../../_layout/admin-shell';
import { safeSelect, storeClient } from '../../_lib/shared';
import { CARRIER_LABEL, formatDateTime, formatWon, ORDER_STATUS_LABEL } from '../../_lib/labels';
import { BuyerPhoneReveal } from './buyer-phone-reveal';
import { PaymentShipmentCard } from './payment-shipment-card';

export const metadata = { title: '스토어 주문 상세' };

interface OrderRow {
  id: string;
  order_no: string;
  status: string;
  buyer_name: string;
  buyer_company: string | null;
  buyer_phone_tail4: string;
  tax_invoice: boolean;
  biz_reg_no: string | null;
  ship_postcode: string;
  ship_addr1: string;
  ship_addr2: string | null;
  ship_memo: string | null;
  depositor_name: string | null;
  total_amount: number;
  paid_at: string | null;
  expires_at: string;
  created_at: string;
}

interface OrderItemRow {
  id: string;
  qty: number;
  unit_price: number;
  subtotal: number;
  store_variants: {
    name: string;
    store_products: { name: string } | null;
  } | null;
}

interface ShipmentRow {
  carrier: string;
  tracking_no: string;
  shipped_at: string;
}

interface EventRow {
  id: number;
  from_status: string | null;
  to_status: string;
  actor: string;
  note: string | null;
  created_at: string;
}

export default async function StoreOrderDetailPage(props: {
  params: Promise<{ id: string }>;
}): Promise<ReactElement> {
  try {
    await requireRole({ adminRoles: ['super_admin', 'ops_admin', 'auditor'] });
  } catch (error) {
    if (error instanceof RedirectError) redirect('/login?redirect=/store/orders');
    if (error instanceof ForbiddenError) redirect('/login?error=forbidden');
    throw error;
  }

  const { id } = await props.params;
  if (!isValidUuid(id)) notFound();

  const session = await getSession();
  const canMutate =
    !!session?.adminRole && ['super_admin', 'ops_admin'].includes(session.adminRole);

  const client = storeClient(await getServerClient());

  const order = await safeSelect<OrderRow>(
    client
      .from('store_orders')
      .select(
        'id, order_no, status, buyer_name, buyer_company, buyer_phone_tail4, tax_invoice, biz_reg_no, ship_postcode, ship_addr1, ship_addr2, ship_memo, depositor_name, total_amount, paid_at, expires_at, created_at',
      )
      .eq('id', id)
      .maybeSingle(),
  );
  if (!order) notFound();

  const [itemsData, shipment, eventsData] = await Promise.all([
    safeSelect<OrderItemRow[]>(
      client
        .from('store_order_items')
        .select('id, qty, unit_price, subtotal, store_variants(name, store_products(name))')
        .eq('order_id', id),
    ),
    safeSelect<ShipmentRow>(
      client
        .from('store_shipments')
        .select('carrier, tracking_no, shipped_at')
        .eq('order_id', id)
        .maybeSingle(),
    ),
    safeSelect<EventRow[]>(
      client
        .from('store_order_events')
        .select('id, from_status, to_status, actor, note, created_at')
        .eq('order_id', id)
        .order('created_at', { ascending: false })
        .limit(20),
    ),
  ]);

  const items = itemsData ?? [];
  const events = eventsData ?? [];

  return (
    <AdminShell activeNav="storeOrders" title="스토어 주문 상세">
      <div className="mx-auto max-w-screen-xl space-y-6 px-6 py-6">
        <header className="flex items-baseline justify-between">
          <div>
            <Link className="text-muted-foreground text-sm hover:underline" href="/store/orders">
              ← 주문 목록
            </Link>
            <h2 className="text-2xl font-bold">{order.order_no}</h2>
            <p className="text-muted-foreground text-sm">접수 {formatDateTime(order.created_at)}</p>
          </div>
          <Badge className="text-sm" variant="outline">
            {ORDER_STATUS_LABEL[order.status] ?? order.status}
          </Badge>
        </header>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">주문 항목</CardTitle>
              </CardHeader>
              <CardContent>
                {items.length === 0 ? (
                  <p className="text-muted-foreground text-sm">항목 정보가 없습니다.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-xs uppercase tracking-wider">
                          <th className="text-muted-foreground px-2 py-2 text-left font-semibold">상품</th>
                          <th className="text-muted-foreground px-2 py-2 text-left font-semibold">수량</th>
                          <th className="text-muted-foreground px-2 py-2 text-left font-semibold">단가</th>
                          <th className="text-muted-foreground px-2 py-2 text-left font-semibold">소계</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((it) => (
                          <tr className="border-b last:border-0" key={it.id}>
                            <td className="px-2 py-2">
                              {it.store_variants?.store_products?.name ?? '-'}
                              <span className="text-muted-foreground"> · {it.store_variants?.name ?? '-'}</span>
                            </td>
                            <td className="px-2 py-2 tabular-nums">{it.qty}</td>
                            <td className="px-2 py-2 tabular-nums">{formatWon(it.unit_price)}</td>
                            <td className="px-2 py-2 font-medium tabular-nums">{formatWon(it.subtotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td className="px-2 py-2 text-right font-semibold" colSpan={3}>
                            총액
                          </td>
                          <td className="px-2 py-2 font-bold tabular-nums">{formatWon(order.total_amount)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">주문자 · 배송지</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm md:grid-cols-2">
                <Field label="주문자" value={order.buyer_name} />
                <Field label="상호" value={order.buyer_company ?? '-'} />
                <div>
                  <p className="text-muted-foreground text-xs">연락처</p>
                  <BuyerPhoneReveal orderId={order.id} phoneTail4={order.buyer_phone_tail4} />
                </div>
                <Field label="입금자명" value={order.depositor_name ?? '-'} />
                <Field
                  label="배송지"
                  value={`(${order.ship_postcode}) ${order.ship_addr1} ${order.ship_addr2 ?? ''}`}
                  span2
                />
                {order.ship_memo ? <Field label="배송 메모" value={order.ship_memo} span2 /> : null}
                <Field
                  label="세금계산서"
                  value={order.tax_invoice ? `요청 (사업자번호 ${order.biz_reg_no ?? '-'})` : '요청 안 함'}
                  span2
                />
              </CardContent>
            </Card>

            {shipment ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">배송 정보</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm md:grid-cols-2">
                  <Field label="택배사" value={CARRIER_LABEL[shipment.carrier] ?? shipment.carrier} />
                  <Field label="운송장 번호" value={shipment.tracking_no} />
                  <Field label="발송일시" value={formatDateTime(shipment.shipped_at)} />
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">상태 이력 (최근 {events.length}건)</CardTitle>
              </CardHeader>
              <CardContent>
                {events.length === 0 ? (
                  <p className="text-muted-foreground text-sm">기록 없음</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {events.map((e) => (
                      <li className="flex items-baseline justify-between gap-2 border-b pb-2 last:border-0" key={e.id}>
                        <div className="min-w-0">
                          <p className="font-medium">
                            {e.from_status ? `${ORDER_STATUS_LABEL[e.from_status] ?? e.from_status} → ` : ''}
                            {ORDER_STATUS_LABEL[e.to_status] ?? e.to_status}
                          </p>
                          <p className="text-muted-foreground truncate text-xs">
                            {e.note ?? '-'} · {e.actor}
                          </p>
                        </div>
                        <span className="text-muted-foreground text-xs whitespace-nowrap">
                          {formatDateTime(e.created_at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <div>
            {canMutate ? (
              <PaymentShipmentCard orderId={order.id} orderNo={order.order_no} status={order.status} />
            ) : (
              <Card>
                <CardContent className="text-muted-foreground py-6 text-sm">
                  입금확인/운송장 등록 권한 없음 (감사 모드).
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
