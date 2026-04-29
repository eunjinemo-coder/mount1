import { Loader2 } from 'lucide-react';
import type { ReactElement } from 'react';

export default function DriverLoading(): ReactElement {
  return (
    <div className="bg-background flex min-h-dvh flex-col">
      {/* 헤더 placeholder */}
      <div className="bg-background sticky top-0 flex h-14 items-center border-b px-4">
        <div className="bg-muted h-4 w-24 animate-pulse rounded" />
      </div>

      {/* 본문 — 중앙 spinner */}
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="text-muted-foreground size-8 animate-spin" aria-hidden />
          <p className="text-muted-foreground text-sm">불러오는 중…</p>
        </div>
      </div>

      {/* 하단 nav placeholder */}
      <div className="bg-background safe-bottom sticky bottom-0 border-t">
        <div className="grid h-16 grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-center">
              <div className="bg-muted size-5 animate-pulse rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
