import 'server-only';

/**
 * store_message_log 기반 MessageStore 구현 (@mount/lib/notify 계약).
 *
 * store_ 테이블은 dev DB 미push 라 generated types 에 없다 → store 앱 store-tables.ts 와
 * 동일 철학으로 untyped 쿼리 빌더를 국소 캐스팅한다(push 후 걷어냄). no-explicit-any 회피를
 * 위해 사용하는 메서드만 좁게 선언.
 *
 * 멱등: insertPendingReturning 은 dedupe_key unique 충돌 시 no-op → row=null(발송 skip).
 * listRetryable 은 pending/failed(attempts<3) 만 → sent 된 행은 재조회 안 됨(크론 재실행 안전).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  EnqueueParams,
  MessageRow,
  MessageStore,
  NotifyVariables,
  SendChannel,
} from '@mount/lib/notify';

interface PgError {
  message: string;
}
type Result<T> = PromiseLike<{ data: T; error: PgError | null }>;

/** store_message_log DB 행(사용 컬럼). */
interface LogRow {
  id: string;
  dedupe_key: string;
  order_id: string | null;
  template: string;
  to_phone: string;
  status: 'pending' | 'sent' | 'failed';
  attempts: number;
  variables: NotifyVariables | null;
}

// ── untyped 쿼리 빌더(사용 메서드만) ─────────────────────────────────────────
//   store-tables.ts(store 앱)와 동일 철학: 체인은 self(Builder), 종단은 await 로 {data,error}.
interface UpsertOptions {
  onConflict: string;
  ignoreDuplicates: boolean;
}
interface Builder extends Result<LogRow[] | null> {
  select: (columns: string) => Builder;
  eq: (column: string, value: string | number) => Builder;
  in: (column: string, values: readonly (string | number)[]) => Builder;
  lt: (column: string, value: number) => Builder;
  order: (column: string, options: { ascending: boolean }) => Builder;
  limit: (n: number) => Builder;
  maybeSingle: () => Result<LogRow | null>;
  insert: (values: Record<string, unknown>) => Result<null>;
  update: (values: Record<string, unknown>) => Builder;
  upsert: (values: Record<string, unknown>, options: UpsertOptions) => Builder;
}

function table(client: SupabaseClient): Builder {
  return (client as unknown as { from: (t: string) => Builder }).from('store_message_log');
}

function toMessageRow(r: LogRow): MessageRow {
  return {
    id: r.id,
    dedupeKey: r.dedupe_key,
    orderId: r.order_id,
    template: r.template,
    toPhone: r.to_phone,
    status: r.status,
    attempts: r.attempts,
    variables: r.variables ?? {},
  };
}

/** MessageStore + admin 액션용 enqueue-return 확장. */
export interface AdminMessageStore extends MessageStore {
  /** 삽입된 행 반환(충돌 멱등 시 null). admin 액션의 즉시 enqueue+flush 용. */
  insertPendingReturning(p: EnqueueParams): Promise<{ row: MessageRow | null }>;
}

export function createMessageStore(client: SupabaseClient): AdminMessageStore {
  async function insertPendingReturning(p: EnqueueParams): Promise<{ row: MessageRow | null }> {
    const { data, error } = await table(client)
      .upsert(
        {
          dedupe_key: p.dedupeKey,
          order_id: p.orderId,
          template: p.template,
          to_phone: p.toPhone,
          variables: p.variables,
          status: 'pending',
        },
        { onConflict: 'dedupe_key', ignoreDuplicates: true },
      )
      .select('id, dedupe_key, order_id, template, to_phone, status, attempts, variables')
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { row: data ? toMessageRow(data) : null };
  }

  return {
    insertPendingReturning,

    async insertPending(p: EnqueueParams): Promise<{ inserted: boolean }> {
      const { row } = await insertPendingReturning(p);
      return { inserted: row !== null };
    },

    async listRetryable(limit: number): Promise<MessageRow[]> {
      const { data, error } = await table(client)
        .select('id, dedupe_key, order_id, template, to_phone, status, attempts, variables')
        .in('status', ['pending', 'failed'])
        .lt('attempts', 3)
        .order('created_at', { ascending: true })
        .limit(limit);
      if (error) throw new Error(error.message);
      return (data ?? []).map(toMessageRow);
    },

    async markSent(id: string, _channel?: SendChannel, _providerMessageId?: string): Promise<void> {
      const { error } = await table(client)
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw new Error(error.message);
    },

    async markFailed(id: string, errorText: string): Promise<void> {
      // attempts 증가 — supabase-js 는 컬럼 표현식 증가를 지원 안 해 read→write.
      // (크론은 15분 주기 단독 실행이라 경합 위험 낮음)
      const { data: current } = await table(client)
        .select('attempts')
        .eq('id', id)
        .maybeSingle();
      const attempts = (current?.attempts ?? 0) + 1;
      const { error } = await table(client)
        .update({
          status: 'failed',
          attempts,
          last_error: errorText.slice(0, 500),
        })
        .eq('id', id);
      if (error) throw new Error(error.message);
    },
  };
}
