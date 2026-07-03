/**
 * store 운영 코어(payment/shipment/cron)가 공유하는 DI 타입.
 * 실 구현은 notify-adapter.ts 가 supabase 클라이언트로 조립(테스트는 mock).
 */
import type { EnqueueParams } from '@mount/lib/notify';

export interface RpcResult {
  data: unknown;
  error: { message: string } | null;
}

/** callRpc 를 특정 함수에 바인딩한 호출부. */
export type RpcCall = (args: Record<string, unknown>) => Promise<RpcResult>;

/** 성공 후 구매자 알림에 필요한 컨텍스트. */
export interface NotifyContext {
  orderNo: string;
  /** 구매자 전화(복호화 원문). 로그 금지. */
  phone: string;
}

/** enqueue + flush best-effort. 예외를 삼켜 호출측 성공을 막지 않는다. */
export type NotifyFn = (params: EnqueueParams) => Promise<void>;
