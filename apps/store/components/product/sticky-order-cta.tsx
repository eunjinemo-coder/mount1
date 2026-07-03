import { formatCurrencyKRW } from '@mount/lib';
import Link from 'next/link';
import type { ReactElement } from 'react';

interface Props {
  basePrice: number;
  slug: string;
}

/**
 * 하단 sticky CTA.
 * 주 CTA(주문하기)는 S3 주문서(/order/[slug])로 연결.
 * 보조 CTA(대량 견적 문의)는 /quote 로 연결 — 리드 확보 채널.
 */
export function StickyOrderCta({ basePrice, slug }: Props): ReactElement {
  return (
    <div className="border-border bg-background/95 safe-bottom fixed inset-x-0 bottom-0 z-fixed border-t backdrop-blur">
      <div className="mx-auto max-w-lg px-5 py-3">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-muted-foreground text-xs">1개 기준</span>
          <span className="tabular text-lg font-bold">
            {formatCurrencyKRW(basePrice)}
            <span className="text-muted-foreground ml-1 text-xs font-normal">부터</span>
          </span>
        </div>
        <div className="flex gap-2.5">
          <Link
            href="/quote"
            className="border-input hover:bg-accent flex h-12 flex-1 items-center justify-center rounded-xl border text-sm font-semibold transition-colors"
          >
            대량 견적 문의
          </Link>
          <Link
            href={`/order/${slug}`}
            className="bg-primary text-primary-foreground flex h-12 flex-[1.4] items-center justify-center rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
          >
            주문하기
          </Link>
        </div>
      </div>
    </div>
  );
}
