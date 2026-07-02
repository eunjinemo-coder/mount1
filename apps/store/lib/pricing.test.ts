import { describe, expect, it } from 'vitest';
import {
  calcLineSubtotal,
  calcTotalSavings,
  calcUnitSavings,
  resolveUnitPrice,
  type PriceTier,
} from './pricing';

// seed(0022) 스탠다드: 89,000 / 10↑ 79,000 / 50↑ 69,000
const BASE = 89000;
const TIERS: PriceTier[] = [
  { minQty: 10, unitPrice: 79000 },
  { minQty: 50, unitPrice: 69000 },
];

describe('resolveUnitPrice — 구간 경계 (min_qty-1 / min_qty / min_qty+1)', () => {
  it('1개 → base', () => expect(resolveUnitPrice(BASE, TIERS, 1)).toBe(89000));
  it('9개(10 미만) → base', () => expect(resolveUnitPrice(BASE, TIERS, 9)).toBe(89000));
  it('10개(경계) → 79000', () => expect(resolveUnitPrice(BASE, TIERS, 10)).toBe(79000));
  it('11개(경계+1) → 79000', () => expect(resolveUnitPrice(BASE, TIERS, 11)).toBe(79000));
  it('49개(50 미만) → 79000', () => expect(resolveUnitPrice(BASE, TIERS, 49)).toBe(79000));
  it('50개(경계) → 69000', () => expect(resolveUnitPrice(BASE, TIERS, 50)).toBe(69000));
  it('51개(경계+1) → 69000', () => expect(resolveUnitPrice(BASE, TIERS, 51)).toBe(69000));
  it('100개 → 최저구간 69000', () => expect(resolveUnitPrice(BASE, TIERS, 100)).toBe(69000));
});

describe('resolveUnitPrice — tier 정렬 무관', () => {
  it('역순 tier 입력에도 동일 결과', () => {
    const reversed: PriceTier[] = [
      { minQty: 50, unitPrice: 69000 },
      { minQty: 10, unitPrice: 79000 },
    ];
    expect(resolveUnitPrice(BASE, reversed, 10)).toBe(79000);
    expect(resolveUnitPrice(BASE, reversed, 50)).toBe(69000);
  });
  it('tier 없으면 항상 base', () => expect(resolveUnitPrice(BASE, [], 999)).toBe(89000));
});

describe('calcLineSubtotal / 절감액', () => {
  it('10개 소계 = 79000*10', () => expect(calcLineSubtotal(BASE, TIERS, 10)).toBe(790000));
  it('개당 절감 = 89000-79000', () => expect(calcUnitSavings(BASE, 79000)).toBe(10000));
  it('총 절감 = 10000*10', () => expect(calcTotalSavings(BASE, 79000, 10)).toBe(100000));
  it('절감액 음수 방지', () => {
    expect(calcUnitSavings(BASE, 99999)).toBe(0);
    expect(calcTotalSavings(BASE, 99999, 5)).toBe(0);
  });
});
