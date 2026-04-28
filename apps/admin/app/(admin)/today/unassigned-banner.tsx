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
      <AlertCircle className="text-warning size-5 shrink-0" aria-hidden />
      <div className="flex-1">
        <p className="text-sm font-medium">기사 배정이 필요한 주문 {props.count}건</p>
        <p className="text-muted-foreground text-xs">배차 관리 화면에서 기사를 배정해 주세요.</p>
      </div>
      <Button asChild size="sm">
        <Link href="/dispatch">배차 관리로 이동</Link>
      </Button>
    </div>
  );
}
