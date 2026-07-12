'use client';

import { Badge, Button } from '@mount/ui';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactElement } from 'react';
import { PRODUCT_STATUS_LABEL } from '../_lib/labels';
import { toggleStoreProductStatusAction } from './actions';

export function ProductStatusToggle({
  productId,
  status,
}: {
  productId: string;
  status: string;
}): ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const nextStatus = status === 'published' ? 'hidden' : 'published';
  const label = status === 'published' ? '숨기기' : '공개하기';

  const handle = (): void => {
    setError(null);
    startTransition(async () => {
      const r = await toggleStoreProductStatusAction(productId, nextStatus);
      if (r.ok) router.refresh();
      else setError(r.error ?? '실패했습니다.');
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Badge variant={status === 'published' ? 'default' : 'secondary'}>
        {PRODUCT_STATUS_LABEL[status] ?? status}
      </Badge>
      <Button disabled={isPending} onClick={handle} size="sm" variant="outline">
        {isPending ? '처리 중…' : label}
      </Button>
      {error ? <span className="text-destructive text-xs">{error}</span> : null}
    </div>
  );
}
