'use client';

import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@mount/ui';
import { Calendar, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactElement } from 'react';
import { updateOrderScheduleAction, updateOrderStatusAction } from './actions';

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'received', label: '접수' },
  { value: 'happy_call_pending', label: '해피콜 대기' },
  { value: 'happy_call_done', label: '해피콜 완료' },
  { value: 'scheduled', label: '예약 확정' },
  { value: 'assigned', label: '배차 확정' },
  { value: 'postponed', label: '연기' },
  { value: 'on_hold', label: '보류' },
  { value: 'cancel_requested', label: '취소 요청' },
  { value: 'cancel_confirmed_coupang_transfer', label: '취소 확정' },
  { value: 'closed', label: '마감' },
];

function toLocalInputValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function OrderMutateCard(props: {
  orderId: string;
  currentStatus: string;
  currentScheduledAt: string | null;
}): ReactElement {
  const router = useRouter();
  const [status, setStatus] = useState(props.currentStatus);
  const [reason, setReason] = useState('');
  const [scheduledAt, setScheduledAt] = useState(toLocalInputValue(props.currentScheduledAt));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handle = (
    label: string,
    fn: () => Promise<{ ok: boolean; error?: string }>,
  ): void => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const r = await fn();
        if (r.ok) {
          setSuccess(`${label} 완료`);
          router.refresh();
        } else {
          setError(r.error ?? `${label} 실패`);
        }
      } catch {
        setError('권한이 없거나 서버 오류');
      }
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="size-4" />
            상태 수동 변경
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <select
            className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
            onChange={(e) => setStatus(e.target.value)}
            value={status}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <Input
            onChange={(e) => setReason(e.target.value)}
            placeholder="변경 사유 (선택)"
            value={reason}
          />
          <Button
            disabled={isPending || status === props.currentStatus}
            onClick={() =>
              handle('상태 변경', () =>
                updateOrderStatusAction(props.orderId, status, reason || undefined),
              )
            }
            size="sm"
          >
            상태 변경
          </Button>
          <p className="text-muted-foreground text-xs">
            상태 변경은 audit_events 에 자동 기록됩니다.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="size-4" />
            시공 일시 수동 변경
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            onChange={(e) => setScheduledAt(e.target.value)}
            type="datetime-local"
            value={scheduledAt}
          />
          <div className="flex gap-2">
            <Button
              disabled={isPending || scheduledAt === toLocalInputValue(props.currentScheduledAt)}
              onClick={() =>
                handle('시각 변경', () =>
                  updateOrderScheduleAction(
                    props.orderId,
                    scheduledAt ? new Date(scheduledAt).toISOString() : null,
                  ),
                )
              }
              size="sm"
            >
              저장
            </Button>
            <Button
              disabled={isPending || !props.currentScheduledAt}
              onClick={() =>
                handle('시각 비우기', () => updateOrderScheduleAction(props.orderId, null))
              }
              size="sm"
              variant="outline"
            >
              미정으로
            </Button>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <div className="border-destructive/30 bg-destructive/10 rounded-md border px-3 py-2 text-sm">
          <p className="text-destructive">{error}</p>
        </div>
      ) : null}
      {success ? (
        <div className="border-success/30 bg-success/10 rounded-md border px-3 py-2 text-sm">
          {success}
        </div>
      ) : null}
    </div>
  );
}
