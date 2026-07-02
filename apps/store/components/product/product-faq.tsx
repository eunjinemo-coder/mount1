import { ChevronDown } from 'lucide-react';
import type { ReactElement } from 'react';
import type { FaqItem } from '@/lib/dummy-products';

interface Props {
  items: FaqItem[];
}

/**
 * FAQ — 배송·세금계산서·대량구매·A/S.
 * native <details>/<summary> 로 JS 없이 접이식 구현 (서버 컴포넌트 · 접근성 확보).
 */
export function ProductFaq({ items }: Props): ReactElement {
  return (
    <section className="px-5">
      <h2 className="text-xl font-bold tracking-ko-tight">자주 묻는 질문</h2>
      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={item.q}>
            <details className="group border-border/70 bg-card rounded-xl border">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
                <span>{item.q}</span>
                <ChevronDown
                  className="text-muted-foreground size-5 shrink-0 transition-transform duration-base group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <p className="text-muted-foreground border-border/60 border-t px-4 py-3.5 text-sm leading-6">
                {item.a}
              </p>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
