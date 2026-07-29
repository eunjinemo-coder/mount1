'use client';

/**
 * 현장 원탭 상태 전환 — 기사 동선: 도착하면 [시공 시작], 끝나면 [시공 완료].
 * 세부 수정 없이 큰 버튼 한 번으로. (상세 수정은 아래 "시공 정보 수정" 폼)
 */
import { Button } from '@mount/ui';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactElement } from 'react';
import { updateInstallationStatusAction } from '../actions';

const NEXT_ACTION: Record<string, { to: string; label: string } | undefined> = {
  scheduled: { to: 'in_progress', label: '시공 시작' },
  in_progress: { to: 'completed', label: '시공 완료' },
  cancelled: { to: 'scheduled', label: '예정으로 복구' },
};

export function StatusQuickActions({ id, status }: { id: string; status: string }): ReactElement | null {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const next = NEXT_ACTION[status];

  function go(to: string): void {
    setError(null);
    startTransition(async () => {
      const res = await updateInstallationStatusAction(id, to);
      if (!res.ok) setError(res.error ?? '상태 변경 실패');
      else router.refresh();
    });
  }

  if (status === 'completed') {
    return (
      <div className="space-y-1">
        <p className="text-muted-foreground text-sm">
          시공 완료 — 아래에서 <span className="text-foreground font-medium">완료 사진</span>을
          등록하세요.
        </p>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </div>
    );
  }
  if (!next) return null;

  return (
    <div className="space-y-2">
      <Button className="h-12 w-full text-base md:w-auto md:px-8" disabled={pending} onClick={() => go(next.to)}>
        {pending ? '변경 중…' : next.label}
      </Button>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
}
