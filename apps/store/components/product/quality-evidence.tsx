import { Anchor, Layers, Lock, Ruler, ShieldCheck, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactElement } from 'react';
import type { QualityIconKey, QualityPoint } from '@/lib/dummy-products';

interface Props {
  items: QualityPoint[];
}

const ICONS: Record<QualityIconKey, LucideIcon> = {
  shield: ShieldCheck,
  anchor: Anchor,
  ruler: Ruler,
  lock: Lock,
  layers: Layers,
  wrench: Wrench,
};

/**
 * 해결/품질 증거 섹션 — 구조·소재 포인트를 스펙 아이콘 카드로.
 * 페인 포인트에 대한 응답: "그래서 이렇게 만들었습니다".
 */
export function QualityEvidence({ items }: Props): ReactElement {
  return (
    <section className="px-5">
      <h2 className="text-xl font-bold tracking-ko-tight">그래서, 처음부터 다르게 만들었습니다</h2>
      <p className="text-muted-foreground mt-2 text-[15px] leading-7">
        재방문을 부르지 않는 자재. 구조와 소재로 증명합니다.
      </p>

      <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          return (
            <li
              key={item.title}
              className="border-border bg-card rounded-2xl border p-4"
            >
              <span
                className="text-foreground border-border flex size-10 items-center justify-center rounded-xl border"
                aria-hidden
              >
                <Icon className="size-5" />
              </span>
              <h3 className="mt-3 text-[15px] font-semibold leading-snug">{item.title}</h3>
              <p className="text-muted-foreground mt-1 text-sm leading-6">{item.body}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
