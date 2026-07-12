import { describe, expect, it } from 'vitest';
import { signOrderSummary, verifyOrderSummary, type OrderSummary } from './order-summary-cookie';

const SECRET = 'test-secret-abc';
const summary: OrderSummary = {
  orderNo: 'WP260703-483920',
  total: 158000,
  expiresAt: '2026-07-06T00:00:00Z',
};

describe('order-summary-cookie 서명/검증', () => {
  it('서명→검증 왕복 성공 (orderNo 일치)', () => {
    const token = signOrderSummary(summary, SECRET);
    expect(verifyOrderSummary(token, summary.orderNo, SECRET)).toEqual(summary);
  });

  it('orderNo 불일치 → null (URL 위조 방지)', () => {
    const token = signOrderSummary(summary, SECRET);
    expect(verifyOrderSummary(token, 'WP260703-000000', SECRET)).toBeNull();
  });

  it('다른 시크릿으로 검증 → null', () => {
    const token = signOrderSummary(summary, SECRET);
    expect(verifyOrderSummary(token, summary.orderNo, 'other-secret')).toBeNull();
  });

  it('payload 변조(금액 조작) → 서명 불일치 null', () => {
    const token = signOrderSummary(summary, SECRET);
    const forged: OrderSummary = { ...summary, total: 1 };
    const forgedPayload = Buffer.from(JSON.stringify(forged)).toString('base64url');
    const sig = token.slice(token.lastIndexOf('.') + 1);
    const tampered = `${forgedPayload}.${sig}`;
    expect(verifyOrderSummary(tampered, summary.orderNo, SECRET)).toBeNull();
  });

  it('빈/형식오류 토큰 → null', () => {
    expect(verifyOrderSummary(undefined, summary.orderNo, SECRET)).toBeNull();
    expect(verifyOrderSummary('', summary.orderNo, SECRET)).toBeNull();
    expect(verifyOrderSummary('no-dot-token', summary.orderNo, SECRET)).toBeNull();
  });
});
