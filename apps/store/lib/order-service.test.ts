import { describe, expect, it, vi } from 'vitest';
import { createOrder, type OrderDeps } from './order-service';

const validInput = {
  clientKey: '11111111-1111-4111-8111-111111111111',
  slug: 'no-drill-bracket-standard',
  items: [{ variantId: '22222222-2222-4222-8222-222222222222', qty: 2 }],
  buyerName: '김현장',
  buyerPhone: '010-1234-5678',
  taxInvoice: false,
  shipPostcode: '12345',
  shipAddr1: '서울시 강남구 테헤란로 1',
};

function makeDeps(over: Partial<OrderDeps> = {}): OrderDeps {
  return {
    rpc: vi.fn().mockResolvedValue({
      data: { order_no: 'WP260703-483920', total_amount: 158000, expires_at: '2026-07-06T00:00:00Z' },
      error: null,
    }),
    rateLimit: vi.fn().mockResolvedValue({ allowed: true }),
    rateLimitKey: 'store_order:test-ip',
    onUnknownError: vi.fn(),
    ...over,
  };
}

describe('createOrder — 성공 경로', () => {
  it('RPC 성공 시 orderNo/total/expiresAt 반환', async () => {
    const deps = makeDeps();
    const r = await createOrder(deps, validInput);
    expect(r).toEqual({
      ok: true,
      orderNo: 'WP260703-483920',
      total: 158000,
      expiresAt: '2026-07-06T00:00:00Z',
    });
    expect(deps.rpc).toHaveBeenCalledOnce();
  });

  it('RPC 인자를 snake_case 로 매핑하고 휴대폰을 숫자정규화', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { order_no: 'WP260703-000001' }, error: null });
    await createOrder(makeDeps({ rpc }), validInput);
    const call = rpc.mock.calls[0]!;
    const name = call[0] as string;
    const args = call[1] as Record<string, unknown>;
    expect(name).toBe('create_store_order');
    expect(args.p_client_key).toBe(validInput.clientKey);
    expect(args.p_buyer_phone).toBe('01012345678');
    expect(args.p_items).toEqual([{ variant_id: validInput.items[0]!.variantId, qty: 2 }]);
    expect(args.p_biz_reg_no).toBeNull();
  });
});

describe('createOrder — RPC 에러 매핑 (영문/한국어)', () => {
  it('영문 토큰 invalid_phone → buyerPhone 필드 에러', async () => {
    const r = await createOrder(
      makeDeps({ rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'invalid_phone' } }) }),
      validInput,
    );
    expect(r).toMatchObject({ ok: false, fieldErrors: { buyerPhone: expect.stringContaining('휴대폰') } });
  });

  it('영문 토큰 insufficient_stock → items 필드 에러', async () => {
    const r = await createOrder(
      makeDeps({
        rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'insufficient_stock' } }),
      }),
      validInput,
    );
    expect(r).toMatchObject({ ok: false, fieldErrors: { items: expect.stringContaining('재고') } });
  });

  it('한국어 문장 → items 필드 에러', async () => {
    const r = await createOrder(
      makeDeps({
        rpc: vi
          .fn()
          .mockResolvedValue({ data: null, error: { message: '주문 항목이 너무 많습니다(최대 50종).' } }),
      }),
      validInput,
    );
    expect(r).toMatchObject({ ok: false, fieldErrors: { items: expect.any(String) } });
  });

  it('미지 에러 → onUnknownError 호출 + 원문 미노출', async () => {
    const onUnknownError = vi.fn();
    const r = await createOrder(
      makeDeps({
        onUnknownError,
        rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'ERROR 42883 boom' } }),
      }),
      validInput,
    );
    expect(onUnknownError).toHaveBeenCalledOnce();
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.formError).not.toContain('42883');
  });
});

describe('createOrder — 게이트', () => {
  it('zod 실패 시 RPC 미호출 + 필드 에러', async () => {
    const rpc = vi.fn();
    const r = await createOrder(makeDeps({ rpc }), { ...validInput, buyerPhone: '01212345678' });
    expect(rpc).not.toHaveBeenCalled();
    expect(r).toMatchObject({ ok: false, fieldErrors: { buyerPhone: expect.any(String) } });
  });

  it('rate limit 초과 시 RPC 미호출 + formError', async () => {
    const rpc = vi.fn();
    const r = await createOrder(
      makeDeps({ rpc, rateLimit: vi.fn().mockResolvedValue({ allowed: false }) }),
      validInput,
    );
    expect(rpc).not.toHaveBeenCalled();
    expect(r).toMatchObject({ ok: false, formError: expect.stringContaining('요청이 너무 많') });
  });

  it('RPC 빈 결과 → generic formError + onUnknownError', async () => {
    const onUnknownError = vi.fn();
    const r = await createOrder(
      makeDeps({ onUnknownError, rpc: vi.fn().mockResolvedValue({ data: null, error: null }) }),
      validInput,
    );
    expect(onUnknownError).toHaveBeenCalledOnce();
    expect(r.ok).toBe(false);
  });
});
