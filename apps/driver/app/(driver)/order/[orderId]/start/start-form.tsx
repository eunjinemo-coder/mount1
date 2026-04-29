'use client';

import { Button } from '@mount/ui';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactElement } from 'react';
import { startInstallationAction } from './actions';

export interface StartFormProps {
  orderId: string;
  status: string;
  allPhotosReady: boolean;
  missingCount: number;
}

export function StartForm(props: StartFormProps): ReactElement {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isOnSite = props.status === 'on_site';
  const blocked = !isOnSite || !props.allPhotosReady;

  // 차단 사유 — 가장 우선순위 높은 것 1개만 안내
  const blockReason = !isOnSite
    ? `현장 도착 후 가능 (현재: ${props.status})`
    : !props.allPhotosReady
      ? `필수 사진 ${props.missingCount}장 부족`
      : null;

  return (
    <div className="space-y-3">
      {error ? (
        <div className="border-destructive/30 bg-destructive/10 rounded-md border px-3 py-2">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      ) : null}

      {blockReason ? (
        <p className="text-muted-foreground rounded-md border bg-muted/30 px-3 py-2 text-sm">
          ⚠️ {blockReason}
        </p>
      ) : null}

      <Button
        className="w-full"
        disabled={blocked || isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await startInstallationAction(props.orderId);
            if (result.ok) {
              router.push(`/order/${props.orderId}`);
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
