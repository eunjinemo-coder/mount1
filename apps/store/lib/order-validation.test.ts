import { describe, expect, it } from 'vitest';
import { lookupSchema, orderSchema, quoteSchema, PHONE_RE } from './order-validation';

const baseOrder = {
  clientKey: '11111111-1111-4111-8111-111111111111',
  slug: 'no-drill-bracket-standard',
  items: [{ variantId: '22222222-2222-4222-8222-222222222222', qty: 2 }],
  buyerName: '김현장',
  buyerPhone: '010-1234-5678',
  taxInvoice: false,
  shipPostcode: '12345',
  shipAddr1: '서울시 강남구 테헤란로 1',
};

describe('PHONE_RE 경계', () => {
  it.each(['01012345678', '0111234567', '01612345678', '01712345678', '01812345678', '01912345678'])(
    '통과: %s',
    (p) => expect(PHONE_RE.test(p)).toBe(true),
  );

  it.each(['01212345678', '01512345678', '0201234567', '010123456', '0101234567890'])(
    '거부: %s',
    (p) => expect(PHONE_RE.test(p)).toBe(false),
  );
});

describe('orderSchema — 휴대폰 정규화', () => {
  it('하이픈 포함 입력을 숫자로 정규화 후 통과', () => {
    const r = orderSchema.safeParse(baseOrder);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.buyerPhone).toBe('01012345678');
  });

  it('012 접두는 거부(buyerPhone 필드 에러)', () => {
    const r = orderSchema.safeParse({ ...baseOrder, buyerPhone: '01212345678' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.some((i) => i.path[0] === 'buyerPhone')).toBe(true);
  });
});

describe('orderSchema — 사업자번호 조건부 필수', () => {
  it('세금계산서 미요청 시 사업자번호 없어도 통과', () => {
    expect(orderSchema.safeParse(baseOrder).success).toBe(true);
  });

  it('세금계산서 요청 + 10자리 → 통과', () => {
    const r = orderSchema.safeParse({ ...baseOrder, taxInvoice: true, bizRegNo: '123-45-67890' });
    expect(r.success).toBe(true);
  });

  it('세금계산서 요청 + 사업자번호 누락 → bizRegNo 에러', () => {
    const r = orderSchema.safeParse({ ...baseOrder, taxInvoice: true, bizRegNo: '' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.some((i) => i.path[0] === 'bizRegNo')).toBe(true);
  });

  it('세금계산서 요청 + 9자리 → bizRegNo 에러', () => {
    const r = orderSchema.safeParse({ ...baseOrder, taxInvoice: true, bizRegNo: '123456789' });
    expect(r.success).toBe(false);
  });
});

describe('orderSchema — 길이 경계', () => {
  it('buyerName 100자 통과 / 101자 거부', () => {
    expect(orderSchema.safeParse({ ...baseOrder, buyerName: '가'.repeat(100) }).success).toBe(true);
    expect(orderSchema.safeParse({ ...baseOrder, buyerName: '가'.repeat(101) }).success).toBe(false);
  });

  it('shipAddr1 300자 통과 / 301자 거부', () => {
    expect(orderSchema.safeParse({ ...baseOrder, shipAddr1: 'a'.repeat(300) }).success).toBe(true);
    expect(orderSchema.safeParse({ ...baseOrder, shipAddr1: 'a'.repeat(301) }).success).toBe(false);
  });

  it('shipMemo 500자 통과 / 501자 거부', () => {
    expect(orderSchema.safeParse({ ...baseOrder, shipMemo: 'a'.repeat(500) }).success).toBe(true);
    expect(orderSchema.safeParse({ ...baseOrder, shipMemo: 'a'.repeat(501) }).success).toBe(false);
  });

  it('items 50종 통과 / 51종 거부', () => {
    const mk = (n: number) =>
      Array.from({ length: n }, () => ({
        variantId: '22222222-2222-4222-8222-222222222222',
        qty: 1,
      }));
    expect(orderSchema.safeParse({ ...baseOrder, items: mk(50) }).success).toBe(true);
    expect(orderSchema.safeParse({ ...baseOrder, items: mk(51) }).success).toBe(false);
  });

  it('qty 0 이하 거부', () => {
    expect(
      orderSchema.safeParse({
        ...baseOrder,
        items: [{ variantId: '22222222-2222-4222-8222-222222222222', qty: 0 }],
      }).success,
    ).toBe(false);
  });

  it('variantId 비-uuid 거부', () => {
    expect(
      orderSchema.safeParse({ ...baseOrder, items: [{ variantId: 'not-a-uuid', qty: 1 }] }).success,
    ).toBe(false);
  });
});

describe('lookupSchema', () => {
  it('정상 주문번호+휴대폰 통과 (대문자 정규화)', () => {
    const r = lookupSchema.safeParse({ orderNo: 'wp260703-483920', phone: '010-1234-5678' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.orderNo).toBe('WP260703-483920');
  });

  it('잘못된 주문번호 포맷 거부', () => {
    expect(lookupSchema.safeParse({ orderNo: 'WP2607-1234', phone: '01012345678' }).success).toBe(
      false,
    );
  });
});

describe('quoteSchema', () => {
  const base = { company: '대한설비', contactName: '김현장', phone: '01012345678', message: '월 30개 발주 문의' };
  it('정상 통과', () => expect(quoteSchema.safeParse(base).success).toBe(true));
  it('message 1000자 통과 / 1001자 거부', () => {
    expect(quoteSchema.safeParse({ ...base, message: 'a'.repeat(1000) }).success).toBe(true);
    expect(quoteSchema.safeParse({ ...base, message: 'a'.repeat(1001) }).success).toBe(false);
  });
});
