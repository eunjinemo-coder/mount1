'use client';

import { Badge, Button } from '@mount/ui';
import { Send } from 'lucide-react';
import { useState, useTransition, type ReactElement } from 'react';
import { markTransferredAction } from './actions';

export interface PendingReport {
  id: string;
  order_id: string;
  category_primary: string;
  situation_note: string;
  technician_name: string | null;
  created_at: string;
}

const CATEGORY_LABEL: Record<string, string> = {
  no_drill_structural: '무타공 불가(구조)',
  conversion_declined: '전환 거절',
  customer_absent_3times: '3회 부재',
  address_issue: '주소 오류',
  tv_model_mismatch: 'TV 모델 불일치',
  etc: '기타',
};

const DATETIME = new Intl.DateTimeFormat('ko-KR', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Seoul',
});

export function TransferTable(props: { reports: PendingReport[] }): ReactElement {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const toggle = (id: string): void => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const toggleAll = (): void => {
    if (selected.size === props.reports.length) setSelected(new Set());
    else setSelected(new Set(props.reports.map((r) => r.id)));
  };

  const submit = (mode: 'transferred_manually' | 'included_in_daily' | 'included_in_weekly'): void => {
    if (selected.size === 0) return;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await markTransferredAction(Array.from(selected), mode);
        if (result.ok) {
          setMessage(`${result.successCount ?? 0}건 마킹 완료`);
          setSelected(new Set());
        } else {
          setError(result.error ?? '실패');
        }
      } catch {
        setError('권한이 없습니다.');
      }
    });
  };

  if (props.reports.length === 0) {
    return (
      <div className="rounded-md border p-6 text-center text-sm">
        <p className="font-semibold">전달 대기 중인 취소 보고가 없어요</p>
        <p className="text-muted-foreground mt-1">모든 보고가 쿠팡 측에 전달 완료되었습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
        <span>
          미전달 <strong>{props.reports.length}건</strong> · 선택 <strong>{selected.size}건</strong>
        </span>
        <div className="flex gap-2">
          <Button
            disabled={selected.size === 0 || isPending}
            onClick={() => submit('transferred_manually')}
            size="sm"
          >
            <Send className="mr-1 size-3.5" />
            수기 전달 완료
          </Button>
          <Button
            disabled={selected.size === 0 || isPending}
            onClick={() => submit('included_in_daily')}
            size="sm"
            variant="outline"
          >
            일일 묶음 포함
          </Button>
          <Button
            disabled={selected.size === 0 || isPending}
            onClick={() => submit('included_in_weekly')}
            size="sm"
            variant="outline"
          >
            주간 묶음 포함
          </Button>
        </div>
      </div>

      {message ? (
        <div className="border-success/30 bg-success/10 text-success-foreground rounded-md border px-3 py-2 text-sm">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="border-destructive/30 bg-destructive/10 rounded-md border px-3 py-2 text-sm">
          <p className="text-destructive">{error}</p>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-xs">
            <tr>
              <th className="px-2 py-2 text-left">
                <input
                  aria-label="전체 선택"
                  checked={selected.size > 0 && selected.size === props.reports.length}
                  onChange={toggleAll}
                  type="checkbox"
                />
              </th>
              <th className="px-2 py-2 text-left">시각</th>
              <th className="px-2 py-2 text-left">사유</th>
              <th className="px-2 py-2 text-left">담당 기사</th>
              <th className="px-2 py-2 text-left">상황 요약</th>
              <th className="px-2 py-2 text-left">주문</th>
            </tr>
          </thead>
          <tbody>
            {props.reports.map((r) => {
              const isSelected = selected.has(r.id);
              const time = DATETIME.format(new Date(r.created_at));
              const note = r.situation_note.length > 60
                ? `${r.situation_note.slice(0, 60)}…`
                : r.situation_note;
              return (
                <tr key={r.id} className="border-t">
                  <td className="px-2 py-2">
                    <input
                      checked={isSelected}
                      onChange={() => toggle(r.id)}
                      type="checkbox"
                    />
                  </td>
                  <td className="px-2 py-2 text-xs">{time}</td>
                  <td className="px-2 py-2">
                    <Badge variant="outline">
                      {CATEGORY_LABEL[r.category_primary] ?? r.category_primary}
                    </Badge>
                  </td>
                  <td className="px-2 py-2">{r.technician_name ?? '-'}</td>
                  <td className="text-muted-foreground px-2 py-2 text-xs">{note}</td>
                  <td className="px-2 py-2 font-mono text-xs">{r.order_id.slice(0, 8)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
