import { describe, expect, it } from 'vitest';
import { GENERIC_STORE_ERROR, mapStoreRpcError } from './errors';

describe('mapStoreRpcError', () => {
  it('알려진 토큰 → 한국어 + known:true', () => {
    expect(mapStoreRpcError('order_not_paid').message).toContain('입금확인');
    expect(mapStoreRpcError('order_not_paid').known).toBe(true);
    expect(mapStoreRpcError('insufficient_stock_at_confirm').message).toContain('재고');
    expect(mapStoreRpcError('unauthorized').message).toContain('권한');
    expect(mapStoreRpcError('invalid_carrier').message).toContain('택배사');
  });

  it('Postgres detail 이 붙어도 토큰 포함이면 매핑', () => {
    expect(mapStoreRpcError('order_not_paid status=expired').known).toBe(true);
  });

  it('미지 토큰 → generic + known:false (원문 미노출)', () => {
    const r = mapStoreRpcError('some_raw_sqlstate_22P02');
    expect(r.known).toBe(false);
    expect(r.message).toBe(GENERIC_STORE_ERROR);
    expect(r.message).not.toContain('22P02');
  });
});
