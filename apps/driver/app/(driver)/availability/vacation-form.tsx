'use client';

import { Button, Input } from '@mount/ui';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactElement } from 'react';
import { addVacationAction } from './actions';

export function VacationForm(): ReactElement {
  const router = useRouter();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (e: React.FormEvent): void => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!startDate || !endDate) {
      setError('시작일과 종료일을 모두 입력해 주세요.');
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      setError('종료일이 시작일보다 빠를 수 없어요.');
      return;
    }

    startTransition(async () => {
      try {
        const r = await addVacationAction({ startDate, endDate, reason });
        if (r.ok) {
          setSuccess('휴가가 등록됐어요.');
          setStartDate('');
          setEndDate('');
          setReason('');
          router.refresh();
        } else {
          setError(r.error ?? '등록 실패');
        }
      } catch {
        setError('인증 정보 만료. 다시 로그인해 주세요.');
      }
    });
  };

  return (
    <form className="space-y-3" onSubmit={submit}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5 block">
          <span className="text-sm font-medium">시작일</span>
          <Input
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setStartDate(e.target.value)}
            required
            type="date"
            value={startDate}
          />
        </label>
        <label className="space-y-1.5 block">
          <span className="text-sm font-medium">종료일</span>
          <Input
            min={startDate || new Date().toISOString().slice(0, 10)}
            onChange={(e) => setEndDate(e.target.value)}
            required
            type="date"
            value={endDate}
          />
        </label>
      </div>
      <label className="space-y-1.5 block">
        <span className="text-sm font-medium">사유 (선택)</span>
        <Input
          maxLength={50}
          onChange={(e) => setReason(e.target.value)}
          placeholder="예: 가족 여행"
          value={reason}
        />
      </label>

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

      <Button className="w-full" disabled={isPending} size="lg" type="submit">
        {isPending ? '등록 중…' : '휴가 등록'}
      </Button>
    </form>
  );
}
