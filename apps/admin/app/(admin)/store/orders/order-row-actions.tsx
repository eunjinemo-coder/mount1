'use client';

import { Button } from '@mount/ui';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactElement } from 'react';
import { confirmStorePaymentAction } from '../actions';

export function OrderRowActions({
  orderId,
  status,
}: {
  orderId: string;
  status: string;
}): ReactElement | null {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (status !== 'awaiting_payment') return null;

  const handle = (): void => {
    setError(null);
    startTransition(async () => {
      const r = await confirmStorePaymentAction(orderId);
      if (r.ok) {
        router.refresh();
      } else if (!r.alreadyProcessed) {
        setError(r.error ?? '입금확인에 실패했습니다.');
      } else {
        router.refresh();
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button disabled={isPending} onClick={handle} size="sm">
        {isPending ? '처리 중…' : '입금확인'}
      </Button>
      {error ? <span className="text-destructive text-xs">{error}</span> : null}
    </div>
  );
}
