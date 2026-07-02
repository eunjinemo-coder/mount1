import { Card, CardContent } from '@mount/ui';
import type { ReactElement } from 'react';
import type { SpecRow } from '@/lib/dummy-products';

interface Props {
  rows: SpecRow[];
}

/**
 * 제품 스펙 표 — TV 인치 호환 · 하중 · 벽면 재질 · VESA · 소재 · 구성품.
 */
export function SpecTable({ rows }: Props): ReactElement {
  return (
    <section className="px-5">
      <h2 className="text-xl font-bold tracking-ko-tight">제품 스펙</h2>
      <Card className="mt-4 border-border/70 shadow-none">
        <CardContent className="p-0">
          <dl className="divide-border/70 divide-y">
            {rows.map((row) => (
              <div key={row.label} className="grid grid-cols-[92px_1fr] gap-3 px-4 py-3">
                <dt className="text-muted-foreground text-sm font-medium">{row.label}</dt>
                <dd className="text-[15px] leading-6">{row.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </section>
  );
}
