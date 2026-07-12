import 'server-only';

/**
 * supabase 클라이언트 → store 운영 코어 DI 조립 (서버 전용).
 *
 * · makeNotify        : enqueue + flush best-effort(예외 삼킴 · 전화 원문 미노출)
 * · makeLoadNotifyContext : rpc_admin_get_store_buyer_phone(복호화·감사로그) + order_no 조회
 * · makeCronDeps      : service_role 크론용 리마인드/만료 RPC + flushPending
 *
 * Solapi 시크릿(loadSolapiConfig)은 서버에서만 읽힌다. 미설정 시 sender 생성이 throw →
 * makeNotify 는 best-effort 라 삼키고, cron 은 route 에서 로깅.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { callRpc } from '@mount/db';
import { captureMessage, log } from '@mount/lib';
import {
  createSolapiSender,
  flushMessage,
  flushPending,
  loadSolapiConfig,
  loadStaticTextConfig,
  maskPhone,
} from '@mount/lib/notify';
import { createMessageStore } from './message-store';
import type { CronDeps } from './cron';
import type { NotifyContext, NotifyFn, RpcCall } from './deps';

export function bindRpc(client: SupabaseClient, name: string): RpcCall {
  return (args) => callRpc(client, name, args);
}

/** store_orders.order_no 조회(untyped — generated types 미포함). */
async function loadOrderNo(client: SupabaseClient, orderId: string): Promise<string | null> {
  const q = (client as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (
          c: string,
          v: string,
        ) => { maybeSingle: () => PromiseLike<{ data: { order_no: string } | null }> };
      };
    };
  })
    .from('store_orders')
    .select('order_no')
    .eq('id', orderId);
  const { data } = await q.maybeSingle();
  return data?.order_no ?? null;
}

export function makeLoadNotifyContext(
  client: SupabaseClient,
): (orderId: string) => Promise<NotifyContext | null> {
  return async (orderId) => {
    try {
      const { data, error } = await callRpc(client, 'rpc_admin_get_store_buyer_phone', {
        p_order_id: orderId,
      });
      if (error) return null;
      const phone = (data as { phone?: string } | null)?.phone;
      if (!phone) return null;
      const orderNo = await loadOrderNo(client, orderId);
      if (!orderNo) return null;
      return { orderNo, phone };
    } catch {
      return null;
    }
  };
}

export function makeNotify(client: SupabaseClient): NotifyFn {
  return async (params) => {
    try {
      const store = createMessageStore(client);
      const sender = createSolapiSender(loadSolapiConfig(), loadStaticTextConfig());
      const { row } = await store.insertPendingReturning(params);
      if (row) await flushMessage(store, sender, row);
    } catch (e) {
      // best-effort — 발송 실패가 입금확인/운송장 성공을 막지 않는다. 전화 원문 미노출.
      log.warn('store notify best-effort 실패', {
        template: params.template,
        to: maskPhone(params.toPhone),
        error: e instanceof Error ? e.message : String(e),
      });
      captureMessage('store notify best-effort 실패', 'warning', { template: params.template });
    }
  };
}

/** service_role 크론 클라이언트 → CronDeps. */
export function makeCronDeps(serviceClient: SupabaseClient): CronDeps {
  return {
    enqueueReminders: bindRpc(serviceClient, 'rpc_store_enqueue_reminders'),
    expireOrders: bindRpc(serviceClient, 'rpc_store_expire_orders'),
    flush: (limit) => {
      const store = createMessageStore(serviceClient);
      const sender = createSolapiSender(loadSolapiConfig(), loadStaticTextConfig());
      return flushPending(store, sender, limit);
    },
    onUnknownError: (message, context) => captureMessage(message, 'error', context),
  };
}
