'use client';

/**
 * A2 목록 행 — 입금확인/운송장 액션 + 액션 후 피드백(성공 배너·행 하이라이트)을
 * 한곳에서 관리한다(팀리드 지시 §3). 두 자식 액션(OrderRowActions·InlineShipment)은
 * 성공/이미처리 시에만 onDone 을 호출하고, 실패는 각자 인라인 에러로 표시한다.
 *
 * router.refresh() 는 네비게이션이 아니라 서버 데이터 재조회라 스크롤 위치가 그대로
 * 유지된다 — 별도 스크롤 복원 로직 불필요(팀리드 지시 §3 "스크롤 위치 보존").
 */
import { Badge } from '@mount/ui';
import { CheckCircle2, Info } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import type { StoreActionResult } from '@/lib/store/payment';
import { formatDateTime, formatWon, ORDER_STATUS_LABEL } from '../_lib/labels';
import { InlineShipment } from './inline-shipment';
import { OrderRowActions } from './order-row-actions';

const BANNER_MS = 4000;
const COLUMN_COUNT = 6;

export interface OrderListRow {
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

export function OrderRow({ order }: { order: OrderListRow }): ReactElement {
  const router = useRouter();
  const [banner, setBanner] = useState<{ tone: 'success' | 'info'; message: string } | null>(null);
  const [highlighted, setHighlighted] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const handleDone = (result: StoreActionResult, successMessage: string): void => {
    if (result.ok) {
      setBanner({ tone: 'success', message: `${order.order_no} ${successMessage}` });
      setHighlighted(true);
    } else if (result.alreadyProcessed) {
      setBanner({ tone: 'info', message: '이미 입금확인된 주문입니다.' });
    }
    router.refresh();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setBanner(null);
      setHighlighted(false);
    }, BANNER_MS);
  };

  return (
    <>
      <tr
        className={`border-b transition-colors duration-500 last:border-0 ${
          highlighted ? 'border-l-primary border-l-2' : 'hover:bg-muted/40'
        }`}
      >
        <td className="text-muted-foreground px-2 py-3 font-mono text-xs">{order.order_no}</td>
        <td className="text-muted-foreground px-2 py-3 tabular-nums">{formatDateTime(order.created_at)}</td>
        <td className="px-2 py-3">
          {order.buyer_name}
          {order.buyer_company ? <span className="text-muted-foreground"> · {order.buyer_company}</span> : null}
          <p className="text-muted-foreground text-xs">***-****-{order.buyer_phone_tail4}</p>
        </td>
        <td className="px-2 py-3">
          <div className="flex items-baseline justify-between gap-3">
            {order.depositor_name ? (
              <span>{order.depositor_name}</span>
            ) : (
              <span className="text-amber-600">입금자명 미기재</span>
            )}
            <span className="text-base font-bold tabular-nums whitespace-nowrap">{formatWon(order.total_amount)}</span>
          </div>
        </td>
        <td className="px-2 py-3">
          <Badge variant="outline">{ORDER_STATUS_LABEL[order.status] ?? order.status}</Badge>
        </td>
        <td className="px-2 py-3 text-right">
          <div className="flex items-center justify-end gap-2">
            <OrderRowActions onDone={handleDone} orderId={order.id} orderNo={order.order_no} status={order.status} />
            <InlineShipment onDone={handleDone} orderId={order.id} orderNo={order.order_no} status={order.status} />
            <Link
              className="text-primary hover:bg-primary/5 inline-flex items-center rounded px-2 py-1 text-xs font-medium hover:underline"
              href={`/store/orders/${order.id}`}
            >
              상세 →
            </Link>
          </div>
        </td>
      </tr>
      {banner ? (
        <tr>
          <td className="px-2 pb-2" colSpan={COLUMN_COUNT}>
            <div
              aria-live="polite"
              className={
                banner.tone === 'success'
                  ? 'border-primary/30 text-primary flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium'
                  : 'border-border text-muted-foreground flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium'
              }
              role="status"
            >
              {banner.tone === 'success' ? (
                <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
              ) : (
                <Info className="size-3.5 shrink-0" aria-hidden />
              )}
              {banner.message}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
