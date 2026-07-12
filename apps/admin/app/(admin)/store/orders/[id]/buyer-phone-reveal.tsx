'use client';

import { Button } from '@mount/ui';
import { Eye, EyeOff } from 'lucide-react';
import { useState, useTransition, type ReactElement } from 'react';
import { revealBuyerPhoneAction } from './actions';

export function BuyerPhoneReveal({
  orderId,
  phoneTail4,
}: {
  orderId: string;
  phoneTail4: string;
}): ReactElement {
  const [phone, setPhone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (phone) {
    return (
      <div className="flex items-center gap-2">
        <span className="font-medium tabular-nums">{phone}</span>
        <Button onClick={() => setPhone(null)} size="sm" variant="ghost">
          <EyeOff className="mr-1 size-3" aria-hidden />
          숨기기
        </Button>
      </div>
    );
  }

  const handle = (): void => {
    setError(null);
    startTransition(async () => {
      const r = await revealBuyerPhoneAction(orderId);
      if (r.ok && r.phone) setPhone(r.phone);
      else setError(r.error ?? '조회에 실패했습니다.');
    });
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground tabular-nums">***-****-{phoneTail4}</span>
      <Button disabled={isPending} onClick={handle} size="sm" variant="outline">
        <Eye className="mr-1 size-3" aria-hidden />
        {isPending ? '조회 중…' : '표시'}
      </Button>
      {error ? <span className="text-destructive text-xs">{error}</span> : null}
    </div>
  );
}
