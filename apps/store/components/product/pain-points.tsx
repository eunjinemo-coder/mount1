import { Card, CardContent } from '@mount/ui';
import { AlertTriangle } from 'lucide-react';
import type { ReactElement } from 'react';
import type { PainPoint } from '@/lib/dummy-products';

interface Props {
  items: PainPoint[];
}

/**
 * 공감/문제 섹션 — 싸구려 브라켓의 하자·AS 리스크·재시공 비용을 기사 관점으로.
 * "어차피 하고 싶은 무타공, 브라켓은 제대로 된 걸 써라" 설득의 도입부.
 */
export function PainPoints({ items }: Props): ReactElement {
  return (
    <section className="px-5">
      <h2 className="text-xl font-bold tracking-ko-tight">브라켓 하나가 현장 전체를 흔듭니다</h2>
      <p className="text-muted-foreground mt-2 text-[15px] leading-7">
        무타공 시공, 이왕 하실 거면 자재부터 여유가 있어야 합니다. 현장에서 자주 겪는 상황입니다.
      </p>

      <ul className="mt-5 space-y-3">
        {items.map((item) => (
          <li key={item.title}>
            <Card className="border-border rounded-2xl shadow-none">
              <CardContent className="flex gap-3 p-4">
                <span
                  className="text-warning border-border flex size-9 shrink-0 items-center justify-center rounded-full border"
                  aria-hidden
                >
                  <AlertTriangle className="size-[18px]" />
                </span>
                <div>
                  <h3 className="text-[15px] font-semibold leading-snug">{item.title}</h3>
                  <p className="text-muted-foreground mt-1 text-sm leading-6">{item.body}</p>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
