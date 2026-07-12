import { describe, expect, it, vi } from 'vitest';
import { confirmStorePaymentCore, type PaymentDeps } from './payment';
import type { NotifyContext } from './deps';

const ORDER_ID = '11111111-1111-4111-8111-111111111111';

function makeDeps(over: Partial<PaymentDeps> = {}): PaymentDeps {
  return {
    confirmPayment: vi.fn().mockResolvedValue({ data: { status: 'paid', already_processed: false }, error: null }),
    loadNotifyContext: vi
      .fn()
      .mockResolvedValue({ orderNo: 'WP260703-1', phone: '01012345678' } satisfies NotifyContext),
    notify: vi.fn().mockResolvedValue(undefined),
    onUnknownError: vi.fn(),
    ...over,
  };
}

describe('confirmStorePaymentCore', () => {
  it('잘못된 uuid → RPC 미호출·한국어 에러', async () => {
    const deps = makeDeps();
    const r = await confirmStorePaymentCore(deps, 'not-a-uuid');
    expect(r.ok).toBe(false);
    expect(deps.confirmPayment).not.toHaveBeenCalled();
  });

  it('성공 → 구매자 payment_confirmed 알림 enqueue(dedupe)', async () => {
    const deps = makeDeps();
    const r = await confirmStorePaymentCore(deps, ORDER_ID);
    expect(r.ok).toBe(true);
    expect(r.status).toBe('paid');
    expect(deps.notify).toHaveBeenCalledWith({
      dedupeKey: `payment_confirmed:${ORDER_ID}`,
      orderId: ORDER_ID,
      template: 'payment_confirmed',
      toPhone: '01012345678',
      variables: { order_no: 'WP260703-1' },
    });
  });

  it('RPC 에러(알려진 토큰) → 한국어 매핑·미발송·onUnknownError 미호출', async () => {
    const deps = makeDeps({
      confirmPayment: vi.fn().mockResolvedValue({ data: null, error: { message: 'insufficient_stock_at_confirm' } }),
    });
    const r = await confirmStorePaymentCore(deps, ORDER_ID);
    expect(r.ok).toBe(false);
    expect(r.error).toContain('재고');
    expect(deps.notify).not.toHaveBeenCalled();
    expect(deps.onUnknownError).not.toHaveBeenCalled();
  });

  it('RPC 에러(미지 토큰) → generic + onUnknownError 호출', async () => {
    const deps = makeDeps({
      confirmPayment: vi.fn().mockResolvedValue({ data: null, error: { message: 'weird_pg_error' } }),
    });
    const r = await confirmStorePaymentCore(deps, ORDER_ID);
    expect(r.ok).toBe(false);
    expect(deps.onUnknownError).toHaveBeenCalledOnce();
  });

  it('알림 컨텍스트 로드 실패(null) → 발송 skip 하되 입금확인은 성공', async () => {
    const deps = makeDeps({ loadNotifyContext: vi.fn().mockResolvedValue(null) });
    const r = await confirmStorePaymentCore(deps, ORDER_ID);
    expect(r.ok).toBe(true);
    expect(deps.notify).not.toHaveBeenCalled();
  });

  it('already_processed 반영(멱등 재확인)', async () => {
    const deps = makeDeps({
      confirmPayment: vi
        .fn()
        .mockResolvedValue({ data: { status: 'paid', already_processed: true }, error: null }),
    });
    const r = await confirmStorePaymentCore(deps, ORDER_ID);
    expect(r.alreadyProcessed).toBe(true);
  });
});
