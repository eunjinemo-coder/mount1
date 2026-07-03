import type { ReactElement } from 'react';

interface TrustStat {
  value: string;
  label: string;
}

/**
 * 신뢰 스트립 — 검증 가능한 정성적 문구만 사용(수치 클레임 없음).
 * TODO(은진님 실수치): 실 시공 실적·재주문율·출고 데이터 확정 후 수치 기반 배지로 교체.
 */
const STATS: TrustStat[] = [
  { value: '무타공', label: '전용 설계' },
  { value: '실사용', label: '시공 검증' },
  { value: '익일', label: '출고' },
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
