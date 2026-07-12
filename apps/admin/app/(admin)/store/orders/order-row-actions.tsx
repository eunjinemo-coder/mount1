'use client';

import { Button } from '@mount/ui';
import { useState, useTransition, type ReactElement } from 'react';
import type { StoreActionResult } from '@/lib/store/payment';
import { confirmStorePaymentAction } from '../actions';
import { ConfirmDialog } from './confirm-dialog';

export function OrderRowActions({
  orderId,
  orderNo,
  status,
  onDone,
}: {
  orderId: string;
  orderNo: string;
  status: string;
  onDone: (result: StoreActionResult, successMessage: string) => void;
}): ReactElement | null {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (status !== 'awaiting_payment') return null;

  const handle = (): void => {
    setError(null);
    setConfirmOpen(false);
    startTransition(async () => {
      const r = await confirmStorePaymentAction(orderId);
      if (r.ok || r.alreadyProcessed) {
        onDone(r, '입금확인 완료');
      } else {
        setError(r.error ?? '입금확인에 실패했습니다.');
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button disabled={isPending} onClick={() => setConfirmOpen(true)} size="sm">
        {isPending ? '처리 중…' : '입금확인'}
      </Button>
      {error ? <span className="text-destructive text-xs">{error}</span> : null}
      <ConfirmDialog
        description="구매자에게 SMS/알림톡이 발송됩니다."
        isPending={isPending}
        onConfirm={handle}
        onOpenChange={setConfirmOpen}
        open={confirmOpen}
        title={`${orderNo} 입금확인`}
      />
    </div>
  );
}
