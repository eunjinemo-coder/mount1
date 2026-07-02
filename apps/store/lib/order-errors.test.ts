import { describe, expect, it } from 'vitest';
import { isUnknownRpcError, mapRpcError } from './order-errors';

describe('mapRpcError — 영문 토큰', () => {
  it('invalid_phone → buyerPhone 필드', () => {
    expect(mapRpcError('invalid_phone')).toEqual({
      field: 'buyerPhone',
      message: expect.stringContaining('휴대폰'),
    });
  });
  it('insufficient_stock → items 필드', () => {
    expect(mapRpcError('insufficient_stock').field).toBe('items');
  });
  it('invalid_biz_reg_no → bizRegNo 필드', () => {
    expect(mapRpcError('invalid_biz_reg_no').field).toBe('bizRegNo');
  });
  it('items_required → items 필드', () => {
    expect(mapRpcError('items_required').field).toBe('items');
  });
  it('order_no_generation_failed → 전역(field 없음)', () => {
    expect(mapRpcError('order_no_generation_failed').field).toBeUndefined();
  });
  it('field_too_long → 전역', () => {
    expect(mapRpcError('field_too_long').field).toBeUndefined();
  });
});

describe('mapRpcError — 한국어 문장(FIX-3/4)', () => {
  it('"주문 항목이 너무 많습니다..." → items', () => {
    expect(mapRpcError('주문 항목이 너무 많습니다(최대 50종).').field).toBe('items');
  });
  it('"주문 항목 형식이 올바르지 않습니다." → items', () => {
    expect(mapRpcError('주문 항목 형식이 올바르지 않습니다.').field).toBe('items');
  });
  it('"주문자명이 너무 깁니다..." → buyerName', () => {
    expect(mapRpcError('주문자명이 너무 깁니다(최대 100자).').field).toBe('buyerName');
  });
  it('"입력값 길이가 허용범위를 초과..." → 전역', () => {
    expect(mapRpcError('입력값 길이가 허용범위를 초과했습니다.').field).toBeUndefined();
  });
});

describe('mapRpcError — 미지/누출 방지', () => {
  it('SQLSTATE 원문은 노출하지 않고 generic 반환', () => {
    const m = mapRpcError('ERROR: 22P02: invalid input syntax for type uuid');
    expect(m.field).toBeUndefined();
    expect(m.message).not.toContain('22P02');
    expect(m.message).toContain('문제가 발생');
  });
  it('빈 message → generic', () => {
    expect(mapRpcError('').message).toContain('문제가 발생');
    expect(mapRpcError(null).message).toContain('문제가 발생');
  });
});

describe('isUnknownRpcError', () => {
  it('알려진 토큰 → false', () => {
    expect(isUnknownRpcError('invalid_phone')).toBe(false);
  });
  it('알려진 한국어 문장 → false', () => {
    expect(isUnknownRpcError('주문 항목이 너무 많습니다(최대 50종).')).toBe(false);
  });
  it('미지 message → true (Sentry 캡처 대상)', () => {
    expect(isUnknownRpcError('random pg error 42883')).toBe(true);
    expect(isUnknownRpcError('')).toBe(true);
  });
});
