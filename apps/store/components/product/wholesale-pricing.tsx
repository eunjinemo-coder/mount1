import { formatCurrencyKRW } from '@mount/lib';
import { TrendingDown } from 'lucide-react';
import type { ReactElement } from 'react';
import {
  calcTierSavings,
  calcUnitSavings,
  type DummyPriceTier,
} from '@/lib/dummy-products';

interface Props {
  basePrice: number;
  priceTiers: DummyPriceTier[];
}

interface Row {
  label: string;
  qtyForCalc: number;
  unitPrice: number;
  unitSavings: number;
  totalSavings: number;
  highlight: boolean;
}

/**
 * 수량별 도매 단가표 — B2B 설득의 핵심 섹션.
 * 1개 / 10개+ / 50개+ 구간을 강조하고, 구간별 절감액을 자동 계산해 노출한다.
 * "품질 우위 + 도매가" 논리에서 '도매가'를 시각적으로 가장 강하게 보여주는 자리.
 */
export function WholesalePricing({ basePrice, priceTiers }: Props): ReactElement {
  const sorted = [...priceTiers].sort((a, b) => a.minQty - b.minQty);
  const bestTier = sorted.at(-1);

  const rows: Row[] = [
    {
      label: '1개',
      qtyForCalc: 1,
      unitPrice: basePrice,
      unitSavings: 0,
      totalSavings: 0,
      highlight: false,
    },
    ...sorted.map((tier, idx) => ({
      label: `${tier.minQty}개 이상`,
      qtyForCalc: tier.minQty,
      unitPrice: tier.unitPrice,
      unitSavings: calcUnitSavings(basePrice, tier.unitPrice),
      totalSavings: calcTierSavings(basePrice, tier.unitPrice, tier.minQty),
      highlight: idx === sorted.length - 1,
    })),
  ];

  return (
    <section className="px-5">
      <div className="from-brand-600 to-brand-700 rounded-2xl bg-gradient-to-br p-5 text-white shadow-3">
        <p className="text-brand-100 text-sm font-semibold">도매 단가</p>
        <h2 className="mt-1 text-xl font-bold tracking-ko-tight">많이 받을수록, 개당이 내려갑니다</h2>
        <p className="text-brand-100 mt-2 text-sm leading-6">
          같은 품질을 현장 물량으로 받으실 때 단가입니다. 주문서에서 수량만 입력하면 구간가가 자동
          적용됩니다.
        </p>

        <div className="mt-4 space-y-2.5">
          {rows.map((row) => (
            <div
              key={row.label}
              className={
                row.highlight
                  ? 'rounded-xl bg-white p-4 text-foreground shadow-2'
                  : 'rounded-xl bg-white/10 p-4'
              }
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className={row.highlight ? 'text-[15px] font-bold' : 'text-[15px] font-semibold'}>
                    {row.label}
                  </span>
                  {row.highlight && (
                    <span className="bg-brand-600 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white">
                      최저가
                    </span>
                  )}
                </div>
                <span
                  className={
                    row.highlight
                      ? 'tabular text-xl font-bold'
                      : 'tabular text-lg font-bold text-white'
                  }
                >
                  {formatCurrencyKRW(row.unitPrice)}
                  <span
                    className={
                      row.highlight
                        ? 'text-muted-foreground ml-1 text-xs font-normal'
                        : 'text-brand-100 ml-1 text-xs font-normal'
                    }
                  >
                    /개
                  </span>
                </span>
              </div>

              {row.unitSavings > 0 && (
                <div
                  className={
                    row.highlight
                      ? 'text-success mt-2 flex items-center gap-1.5 text-sm font-medium'
                      : 'text-brand-100 mt-2 flex items-center gap-1.5 text-sm font-medium'
                  }
                >
                  <TrendingDown className="size-4 shrink-0" aria-hidden />
                  <span className="tabular">
                    개당 {formatCurrencyKRW(row.unitSavings)} 절감 · {row.qtyForCalc}개 기준{' '}
                    {formatCurrencyKRW(row.totalSavings)} 절감
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        {bestTier && (
          <p className="text-brand-100 mt-4 text-xs leading-5">
            {bestTier.minQty}개 이상은 개당{' '}
            {formatCurrencyKRW(calcUnitSavings(basePrice, bestTier.unitPrice))} 절감됩니다. 팔레트
            단위·정기 발주는 대량 견적 문의로 별도 단가를 드립니다.
          </p>
        )}
      </div>
    </section>
  );
}
