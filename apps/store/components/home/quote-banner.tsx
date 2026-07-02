import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import type { ReactElement } from 'react';

/**
 * 견적 문의 배너 — 팔레트 단위·정기 발주 리드를 /quote 로 유도.
 */
export function QuoteBanner(): ReactElement {
  return (
    <section className="px-5">
      <Link
        href="/quote"
        className="from-brand-600 to-brand-700 flex items-center justify-between gap-4 rounded-2xl bg-gradient-to-br p-5 text-white shadow-3 transition-shadow hover:shadow-4"
      >
        <div>
          <h2 className="text-lg font-bold tracking-ko-tight">대량으로 상시 받으시나요?</h2>
          <p className="text-brand-100 mt-1 text-sm leading-6">
            팔레트 단위·정기 발주는 별도 도매 단가를 드립니다.
          </p>
        </div>
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/15"
          aria-hidden
        >
          <ArrowRight className="size-5" />
        </span>
      </Link>
    </section>
  );
}
