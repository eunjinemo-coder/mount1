import { Button } from '@mount/ui';
import { Home, SearchX } from 'lucide-react';
import Link from 'next/link';
import type { ReactElement } from 'react';

export default function AdminNotFound(): ReactElement {
  return (
    <main className="bg-background flex min-h-dvh items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="bg-muted mx-auto flex size-16 items-center justify-center rounded-full">
          <SearchX className="text-muted-foreground size-8" aria-hidden />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">페이지를 찾을 수 없어요</h1>
          <p className="text-muted-foreground text-sm leading-7">
            요청하신 주소가 존재하지 않거나 이동되었습니다.
            <br />
            URL 을 다시 확인하거나 홈으로 돌아가 주세요.
          </p>
        </div>

        <Button asChild size="lg">
          <Link href="/today">
            <Home className="size-4" aria-hidden />
            홈으로 가기
          </Link>
        </Button>
      </div>
    </main>
  );
}
