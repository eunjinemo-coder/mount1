'use client';

import { Badge, Button } from '@mount/ui';
import { Camera, FileWarning, Phone } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactElement } from 'react';
import { batchMarkCallsAction } from './batch-actions';

export interface BatchOrderRow {
  order_id: string;
  region: string;
  tv: string;
  status: string;
  pre_call_done: boolean;
  photo_count: number;
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: '예정',
  assigned: '배차완료',
  pre_arrival_called: '통화완료',
  en_route: '이동중',
  on_site: '현장도착',
  in_progress: '시공중',
  no_drill_completed: '완료(무타공)',
  drill_converted_completed: '완료(전환)',
  paid: '결제완료',
  closed: '종료',
  cancel_requested: '취소요청',
  postponed: '연기',
};

export function BatchTable(props: { orders: BatchOrderRow[] }): ReactElement {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const toggleAll = (): void => {
    if (selected.size === props.orders.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(props.orders.filter((o) => !o.pre_call_done).map((o) => o.order_id)));
    }
  };

  const toggle = (id: string): void => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const runBatchCall = (): void => {
    if (selected.size === 0) return;
    setMessage(null);
    startTransition(async () => {
      const result = await batchMarkCallsAction(Array.from(selected));
      const okN = result.successCount ?? 0;
      const failN = result.failCount ?? 0;
      setMessage(
        failN === 0
          ? `${okN}건 통화 기록 완료`
          : `${okN}건 성공 · ${failN}건 실패 (${result.errors?.[0] ?? ''})`,
      );
      setSelected(new Set());
      router.refresh();
    });
  };

  if (props.orders.length === 0) {
    return (
      <div className="rounded-md border p-6 text-center text-sm">
        <p className="font-semibold">오늘 시공 없음</p>
        <p className="text-muted-foreground mt-1">예정된 시공이 들어오면 여기에 표시됩니다.</p>
      </div>
    );
  }

  const callPendingCount = props.orders.filter((o) => !o.pre_call_done).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
        <span>
          통화 미기록 <strong>{callPendingCount}건</strong> · 선택 <strong>{selected.size}건</strong>
        </span>
        <Button
          disabled={selected.size === 0 || isPending}
          onClick={runBatchCall}
          size="sm"
        >
          <Phone className="mr-1 size-3.5" />
          {isPending ? '기록 중…' : '선택 일괄 통화 기록'}
        </Button>
      </div>

      {message ? (
        <div className="border-success/30 bg-success/10 text-success-foreground rounded-md border px-3 py-2 text-sm">
          {message}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-xs">
            <tr>
              <th className="px-2 py-2 text-left">
                <input
                  aria-label="전체 선택"
                  checked={selected.size > 0 && selected.size === callPendingCount}
                  onChange={toggleAll}
                  type="checkbox"
                />
              </th>
              <th className="px-2 py-2 text-left">상태</th>
              <th className="px-2 py-2 text-left">지역 · TV</th>
              <th className="px-2 py-2 text-center">통화</th>
              <th className="px-2 py-2 text-center">사진</th>
              <th className="px-2 py-2 text-right">진행</th>
            </tr>
          </thead>
          <tbody>
            {props.orders.map((o) => {
              const isSelected = selected.has(o.order_id);
              const callDisabled = o.pre_call_done;
              return (
                <tr key={o.order_id} className="border-t">
                  <td className="px-2 py-2">
                    <input
                      aria-label={`주문 ${o.order_id.slice(0, 8)} 선택`}
                      checked={isSelected}
                      disabled={callDisabled}
                      onChange={() => toggle(o.order_id)}
                      type="checkbox"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Badge variant="outline">{STATUS_LABEL[o.status] ?? o.status}</Badge>
                  </td>
                  <td className="px-2 py-2">
                    <p className="font-medium">{o.region}</p>
                    <p className="text-muted-foreground text-xs">{o.tv}</p>
                  </td>
                  <td className="px-2 py-2 text-center">
                    {o.pre_call_done ? (
                      <span className="text-success text-xs">✓</span>
                    ) : (
                      <Link
                        className="text-primary text-xs hover:underline"
                        href={`/order/${o.order_id}/pre-call`}
                      >
                        기록
                      </Link>
                    )}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <Link
                      className={`inline-flex items-center gap-0.5 text-xs hover:underline ${
                        o.photo_count >= 5 ? 'text-success' : 'text-warning'
                      }`}
                      href={`/order/${o.order_id}/photos`}
                    >
                      {o.photo_count >= 5 ? (
                        <Camera className="size-3" />
                      ) : (
                        <FileWarning className="size-3" />
                      )}
                      {o.photo_count}
                    </Link>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <Link
                      className="text-primary text-xs hover:underline"
                      href={`/order/${o.order_id}`}
                    >
                      상세 →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
