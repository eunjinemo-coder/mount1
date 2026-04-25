'use client';

import { Button } from '@mount/ui';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactElement } from 'react';
import { startInstallationAction } from './actions';

export interface StartFormProps {
  orderId: string;
  status: string;
}

export function StartForm(props: StartFormProps): ReactElement {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isOnSite = props.status === 'on_site';

  return (
    <div className="space-y-3">
      {error ? (
        <div className="border-destructive/30 bg-destructive/10 rounded-md border px-3 py-2">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      ) : null}

      {!isOnSite ? (
        <p className="text-muted-foreground text-sm">
          현재 상태: <strong>{props.status}</strong> · 시공 시작은 현장 도착 후 가능합니다.
        </p>
      ) : null}

      <Button
        className="w-full"
        disabled={!isOnSite || isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await startInstallationAction(props.orderId);
            if (result.ok) {
              router.push(`/order/${props.orderId}/photos`);
            } else if (result.error) {
              setError(result.error);
            }
          });
        }}
        size="lg"
      >
        {isPending ? '시작 중…' : '시공 시작'}
      </Button>
    </div>
  );
}
