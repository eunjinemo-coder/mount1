import { describe, expect, it } from 'vitest';
import {
  computeInsertOffset,
  normalizeSheetDate,
  parseVisitTimeMinutes,
  VISIT_TIME_FALLBACK,
  type SortRow,
} from './visit-time';

describe('parseVisitTimeMinutes — "N시"/"N시반"', () => {
  it('오전~정오: N=9~12 → hour=N', () => {
    expect(parseVisitTimeMinutes('9시')).toBe(9 * 60); // 540 (최소)
    expect(parseVisitTimeMinutes('10시')).toBe(600);
    expect(parseVisitTimeMinutes('11시')).toBe(660);
    expect(parseVisitTimeMinutes('12시')).toBe(720);
  });

  it('오후: N=1~8 → hour=N+12', () => {
    expect(parseVisitTimeMinutes('1시')).toBe(13 * 60); // 780
    expect(parseVisitTimeMinutes('2시')).toBe(14 * 60); // 840
    expect(parseVisitTimeMinutes('8시')).toBe(20 * 60); // 1200
  });

  it('반 → +30분', () => {
    expect(parseVisitTimeMinutes('12시반')).toBe(750);
    expect(parseVisitTimeMinutes('1시반')).toBe(810);
    expect(parseVisitTimeMinutes('8시반')).toBe(1230); // 최대
  });

  it('경계 순서: 12시 < 12시반 < 1시 < 1시반 < 2시', () => {
    const seq = ['12시', '12시반', '1시', '1시반', '2시'].map((s) => parseVisitTimeMinutes(s)!);
    expect(seq).toEqual([720, 750, 780, 810, 840]);
    for (let i = 1; i < seq.length; i += 1) expect(seq[i]!).toBeGreaterThan(seq[i - 1]!);
  });

  it('최솟값 9시(540) · 최댓값 8시반(1230)', () => {
    expect(parseVisitTimeMinutes('9시')).toBe(540);
    expect(parseVisitTimeMinutes('8시반')).toBe(1230);
  });

  it('공백 허용', () => {
    expect(parseVisitTimeMinutes(' 2시 ')).toBe(840);
    expect(parseVisitTimeMinutes('2시 반')).toBe(870);
  });

  it('예상외 표기/영업외 → null', () => {
    expect(parseVisitTimeMinutes('오전')).toBeNull();
    expect(parseVisitTimeMinutes('14:00')).toBeNull();
    expect(parseVisitTimeMinutes('0시')).toBeNull();
    expect(parseVisitTimeMinutes('13시')).toBeNull();
    expect(parseVisitTimeMinutes('')).toBeNull();
  });
});

describe('normalizeSheetDate', () => {
  it('ISO 그대로 · 구분자 다양성 허용', () => {
    expect(normalizeSheetDate('2026-07-10')).toBe('2026-07-10');
    expect(normalizeSheetDate('2026.7.10')).toBe('2026-07-10');
    expect(normalizeSheetDate('2026/07/10')).toBe('2026-07-10');
  });
  it('4자리 연도 없는 표기/오형식 → null(append 폴백)', () => {
    expect(normalizeSheetDate('7-10')).toBeNull();
    expect(normalizeSheetDate('미정')).toBeNull();
    expect(normalizeSheetDate('2026-02-30')).toBeNull();
  });
});

describe('computeInsertOffset — 정렬 위치 삽입', () => {
  const rows: SortRow[] = [
    { date: '2026-07-10', visit: '9시' }, // 540
    { date: '2026-07-10', visit: '1시' }, // 780
    { date: '2026-07-10', visit: '2시반' }, // 870
    { date: '2026-07-12', visit: '10시' }, // 600
  ];

  it('같은 날짜 그룹 중간(방문시간 기준)', () => {
    // 12시(720)는 9시(540) 뒤, 1시(780) 앞 → index 1
    expect(computeInsertOffset(rows, { date: '2026-07-10', visit: '12시' })).toBe(1);
  });

  it('더 이른 날짜 → 맨 앞(index 0)', () => {
    expect(computeInsertOffset(rows, { date: '2026-07-09', visit: '3시' })).toBe(0);
  });

  it('같은 날짜·같은 시간 → 동률 그룹 끝(기존 뒤)', () => {
    // 1시(780)와 동률 → 1시 뒤(2시반 앞) = index 2
    expect(computeInsertOffset(rows, { date: '2026-07-10', visit: '1시' })).toBe(2);
  });

  it('날짜 그룹 사이', () => {
    // 07-11 은 07-10 그룹(0..2) 뒤, 07-12(3) 앞 → index 3
    expect(computeInsertOffset(rows, { date: '2026-07-11', visit: '9시' })).toBe(3);
  });

  it('맨 끝(가장 늦은 날짜)', () => {
    expect(computeInsertOffset(rows, { date: '2026-07-20', visit: '9시' })).toBe(rows.length);
  });

  it('방문시간 파싱 실패 → 그 날짜 그룹의 끝', () => {
    // 07-10 그룹 끝(2시반 뒤) = index 3, 다음 날짜(07-12) 앞
    expect(computeInsertOffset(rows, { date: '2026-07-10', visit: '오전미정' })).toBe(3);
    expect(VISIT_TIME_FALLBACK).toBeGreaterThan(1230);
  });

  it('신규행 날짜 파싱 실패 → null(append 폴백)', () => {
    expect(computeInsertOffset(rows, { date: '7-10', visit: '9시' })).toBeNull();
    expect(computeInsertOffset(rows, { date: '미정', visit: '9시' })).toBeNull();
  });

  it('빈 시트 → 0', () => {
    expect(computeInsertOffset([], { date: '2026-07-10', visit: '9시' })).toBe(0);
  });
});
