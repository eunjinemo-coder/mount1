'use client';

import { Button } from '@mount/ui';
import { AlertCircle, Home, RotateCw } from 'lucide-react';
import Link from 'next/link';
import { useEffect, type ReactElement } from 'react';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): ReactElement {
  useEffect(() => {
    // 에러는 Sentry 가 자동 capture (instrumentation.ts)
    console.error('[admin/error]', error);
  }, [error]);

  return (
    <main className="bg-background flex min-h-dvh items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="bg-destructive/10 mx-auto flex size-16 items-center justify-center rounded-full">
          <AlertCircle className="text-destructive size-8" aria-hidden />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">문제가 발생했어요</h1>
          <p className="text-muted-foreground text-sm leading-7">
            화면을 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.
            <br />
            계속되면 본사 운영팀에 알려 주세요.
          </p>
          {error.digest ? (
            <p className="text-muted-foreground/70 mt-2 font-mono text-xs">
              ref: {error.digest}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button onClick={reset} size="lg">
            <RotateCw className="size-4" aria-hidden />
            다시 시도
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/today">
              <Home className="size-4" aria-hidden />
              홈으로
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
