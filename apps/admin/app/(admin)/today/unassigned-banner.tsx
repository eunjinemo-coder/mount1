import { Button } from '@mount/ui';
import { AlertCircle } from 'lucide-react';
import Link from 'next/link';
import type { ReactElement } from 'react';

export interface UnassignedBannerProps {
  count: number;
}

export function UnassignedBanner(props: UnassignedBannerProps): ReactElement {
  return (
    <div className="bg-warning/10 border-warning/40 flex items-center gap-3 rounded-md border px-4 py-3">
      <AlertCircle className="text-warning size-5 shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-medium">미배차 {props.count}건이 있습니다.</p>
        <p className="text-muted-foreground text-xs">배차 콘솔에서 처리해 주세요.</p>
      </div>
      <Button asChild size="sm" variant="outline">
        <Link href="/dispatch">배차 콘솔</Link>
      </Button>
    </div>
  );
}
