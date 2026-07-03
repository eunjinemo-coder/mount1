'use client';

import { Button, Input } from '@mount/ui';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactElement } from 'react';
import { updateStoreVariantStockAction } from '../actions';

export function VariantStockForm({
  variantId,
  productId,
  currentStock,
}: {
  variantId: string;
  productId: string;
  currentStock: number;
}): ReactElement {
  const router = useRouter();
  const [value, setValue] = useState(String(currentStock));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handle = (): void => {
    setError(null);
    const parsed = Number(value);
    startTransition(async () => {
      const r = await updateStoreVariantStockAction(variantId, productId, parsed);
      if (r.ok) router.refresh();
      else setError(r.error ?? '실패했습니다.');
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        className="w-20"
        min={0}
        onChange={(e) => setValue(e.target.value)}
        type="number"
        value={value}
      />
      <Button
        disabled={isPending || value === String(currentStock)}
        onClick={handle}
        size="sm"
        variant="outline"
      >
        {isPending ? '저장 중…' : '저장'}
      </Button>
      {error ? <span className="text-destructive text-xs">{error}</span> : null}
    </div>
  );
}
