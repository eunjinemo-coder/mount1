'use client';

import { Button } from '@mount/ui';
import { AlertCircle, Home, RotateCw } from 'lucide-react';
import Link from 'next/link';
import { useEffect, type ReactElement } from 'react';

export default function StoreError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): ReactElement {
  useEffect(() => {
    console.error('[store/error]', error);
  }, [error]);

  return (
    <main className="bg-background flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="bg-destructive/10 mx-auto flex size-16 items-center justify-center rounded-full">
          <AlertCircle className="text-destructive size-8" aria-hidden />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">문제가 발생했어요</h1>
          <p className="text-muted-foreground text-sm leading-7">
            화면을 불러오는 중 오류가 났어요.
            <br />
            잠시 후 다시 시도해 주세요.
          </p>
          {error.digest ? (
            <p className="text-muted-foreground/70 mt-2 font-mono text-xs">
              ref: {error.digest}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Button onClick={reset} size="lg">
            <RotateCw className="size-4" aria-hidden />
            다시 시도
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/">
              <Home className="size-4" aria-hidden />
              홈으로
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
