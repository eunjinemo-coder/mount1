import { Button } from '@mount/ui';
import { CalendarX } from 'lucide-react';
import Link from 'next/link';
import type { ReactElement } from 'react';

export function EmptyState(): ReactElement {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <div className="bg-muted flex size-16 items-center justify-center rounded-full">
        <CalendarX className="text-muted-foreground size-8" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">오늘 배차된 주문이 없어요</h2>
        <p className="text-muted-foreground text-sm">캘린더에서 다른 날짜를 확인해보세요</p>
      </div>
      <Button asChild variant="outline">
        <Link href="/calendar">캘린더 보기</Link>
      </Button>
    </div>
  );
}
