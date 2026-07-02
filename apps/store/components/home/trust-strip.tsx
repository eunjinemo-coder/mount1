import type { ReactElement } from 'react';

interface TrustStat {
  value: string;
  label: string;
}

/**
 * 신뢰 스트립 — placeholder 수치 3개.
 * TODO(실자료): 아래 수치는 예시. 실 시공 실적·재주문율·출고 데이터 확정 후 교체.
 */
const STATS: TrustStat[] = [
  { value: '1,000+', label: '월 시공 검증' }, // PLACEHOLDER
  { value: '98%', label: '자재 하자 없는 출고' }, // PLACEHOLDER
  { value: '익일', label: '평균 출고' }, // PLACEHOLDER
];

export function TrustStrip(): ReactElement {
  return (
    <section className="px-5">
      <div className="bg-muted/60 grid grid-cols-3 gap-2 rounded-2xl px-2 py-5">
        {STATS.map((stat) => (
          <div key={stat.label} className="text-center">
            <p className="tabular text-primary text-xl font-bold">{stat.value}</p>
            <p className="text-muted-foreground mt-1 text-xs leading-4">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
