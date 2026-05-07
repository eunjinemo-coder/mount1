'use client';

import { Button } from '@mount/ui';
import { Pencil } from 'lucide-react';
import { useState, useTransition, type ReactElement } from 'react';
import { fetchScheduleConflicts, updateScheduleAction } from './schedule-edit-action';

interface Props {
  orderId: string;
  currentScheduledAt: string | null;
  status: string;
}

function formatLocalDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ScheduleEditModal(props: Props): ReactElement {
  const [open, setOpen] = useState(false);
  const [newAt, setNewAt] = useState('');
  const [conflicts, setConflicts] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // 시작 1h 이내인 경우 버튼 비활성
  const now = Date.now();
  const oneHourMs = 60 * 60 * 1000;
  const within1h =
    props.currentScheduledAt !== null &&
    new Date(props.currentScheduledAt).getTime() - now < oneHourMs;
  const isAssigned = props.status === 'assigned';
  const canEdit = isAssigned && !within1h;

  // datetime-local input은 local time(KST)을 기대 — toISOString()은 UTC라 KST 9시간 어긋남.
  // local time을 YYYY-MM-DDTHH:MM 으로 직접 포맷.
  const initialValue = props.currentScheduledAt
    ? formatLocalDateTime(new Date(props.currentScheduledAt))
    : '';

  const handleOpen = () => {
    setNewAt(initialValue);
    setError(null);
    setConflicts(null);
    setOpen(true);
  };

  const handleCheckConflict = (value: string) => {
    setNewAt(value);
    setConflicts(null);
    if (!value) return;
    startTransition(async () => {
      const r = await fetchScheduleConflicts({ orderId: props.orderId, newScheduledAt: value });
      setConflicts(r.count);
    });
  };

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const r = await updateScheduleAction({ orderId: props.orderId, newScheduledAt: newAt });
      if (r.ok) {
        setOpen(false);
      } else if (r.error) {
        setError(r.error);
      }
    });
  };

  if (!isAssigned) return <></>;

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        disabled={!canEdit}
        onClick={handleOpen}
        title={within1h ? '시작 1시간 이내에는 본사 채널로 문의' : '예약 시각 변경'}
      >
        <Pencil className="size-3.5" />
        변경
      </Button>
      {open ? (
        <div
          className="bg-foreground/40 fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="bg-background w-full max-w-md rounded-t-lg p-5 shadow-lg sm:rounded-lg">
            <h2 className="mb-3 text-lg font-bold">예약 시각 변경</h2>
            <p className="text-muted-foreground mb-3 text-xs">
              시작 1시간 전까지 변경 가능 · 본사 admin이 자동 알림 받음
            </p>
            <input
              type="datetime-local"
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-base"
              value={newAt}
              onChange={(e) => handleCheckConflict(e.target.value)}
            />
            {conflicts !== null && conflicts > 0 ? (
              <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
                ±2시간 내 본인 다른 시공 {conflicts}건 — 동선 확인 필요
              </p>
            ) : null}
            {error ? <p className="text-destructive mt-2 text-sm">{error}</p> : null}
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                취소
              </Button>
              <Button
                className="flex-1"
                onClick={handleSave}
                disabled={!newAt || isPending}
              >
                {isPending ? '저장 중…' : '저장'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
