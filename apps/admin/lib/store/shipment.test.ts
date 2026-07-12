import { describe, expect, it, vi } from 'vitest';
import { registerStoreShipmentCore, type ShipmentDeps } from './shipment';

const ORDER_ID = '22222222-2222-4222-8222-222222222222';

function makeDeps(over: Partial<ShipmentDeps> = {}): ShipmentDeps {
  return {
    registerShipment: vi.fn().mockResolvedValue({ data: { ok: true, status: 'shipped' }, error: null }),
    loadNotifyContext: vi.fn().mockResolvedValue({ orderNo: 'WP260703-9', phone: '01055556666' }),
    notify: vi.fn().mockResolvedValue(undefined),
    onUnknownError: vi.fn(),
    ...over,
  };
}

describe('registerStoreShipmentCore — 입력검증', () => {
  it('잘못된 uuid → RPC 미호출', async () => {
    const deps = makeDeps();
    const r = await registerStoreShipmentCore(deps, { orderId: 'x', carrier: 'cj', trackingNo: '123' });
    expect(r.ok).toBe(false);
    expect(deps.registerShipment).not.toHaveBeenCalled();
  });

  it('허용되지 않은 택배사 → 에러', async () => {
    const deps = makeDeps();
    const r = await registerStoreShipmentCore(deps, { orderId: ORDER_ID, carrier: 'fedex', trackingNo: '123' });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('택배사');
    expect(deps.registerShipment).not.toHaveBeenCalled();
  });

  it('빈 운송장 → 에러', async () => {
    const deps = makeDeps();
    const r = await registerStoreShipmentCore(deps, { orderId: ORDER_ID, carrier: 'cj', trackingNo: '   ' });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('운송장');
  });
});

describe('registerStoreShipmentCore — 성공/에러', () => {
  it('성공 → shipped 알림 enqueue(운송장 변수 포함·공백제거)', async () => {
    const deps = makeDeps();
    const ok = await registerStoreShipmentCore(deps, { orderId: ORDER_ID, carrier: 'cj', trackingNo: '1234 5678' });
    expect(ok.ok).toBe(true);
    expect(deps.registerShipment).toHaveBeenCalledWith({
      p_order_id: ORDER_ID,
      p_carrier: 'cj',
      p_tracking_no: '12345678', // 공백 제거
    });
    expect(deps.notify).toHaveBeenCalledWith({
      dedupeKey: `shipped:${ORDER_ID}`,
      orderId: ORDER_ID,
      template: 'shipped',
      toPhone: '01055556666',
      variables: { order_no: 'WP260703-9', carrier: 'cj', tracking_no: '12345678' },
    });
  });

  it('RPC 에러(order_not_paid) → 한국어 매핑·미발송', async () => {
    const deps = makeDeps({
      registerShipment: vi.fn().mockResolvedValue({ data: null, error: { message: 'order_not_paid status=expired' } }),
    });
    const r = await registerStoreShipmentCore(deps, { orderId: ORDER_ID, carrier: 'cj', trackingNo: '123' });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('입금확인');
    expect(deps.notify).not.toHaveBeenCalled();
  });
});
