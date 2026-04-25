'use client';

import { Button, Card, CardContent } from '@mount/ui';
import { WifiOff } from 'lucide-react';
import type { ReactElement } from 'react';

export default function OfflinePage(): ReactElement {
  return (
    <main className="bg-background flex min-h-dvh items-center justify-center px-6 py-10">
      <Card className="w-full max-w-sm">
        <CardContent className="space-y-4 py-8 text-center">
          <div className="bg-muted mx-auto flex size-16 items-center justify-center rounded-full">
            <WifiOff className="text-muted-foreground size-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-foreground text-2xl font-semibold">오프라인 상태입니다</h1>
            <p className="text-muted-foreground text-sm leading-6">
              네트워크 연결을 확인하고 다시 시도해 주세요
            </p>
            <p className="text-muted-foreground text-xs">
              연결이 복구되면 아래 버튼으로 새로고침할 수 있습니다.
            </p>
          </div>
          <Button onClick={() => window.location.reload()} size="lg" type="button">
            새로고침
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
