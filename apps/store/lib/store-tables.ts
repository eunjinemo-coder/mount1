/**
 * store_ 테이블 최소 타입 façade (pre-push 우회).
 *
 * 0021_store.sql 의 테이블들은 dev DB 에 아직 push 되지 않아 packages/db 의 generated
 * types(Functions/Tables union)에 존재하지 않는다. supabase-js 의 타입드 `.from()` 은
 * 이들을 모르므로, callRpc(packages/db/src/rpc.ts)와 동일한 철학으로 여기서 unknown 경유
 * 캐스팅을 국소화한다. push 후 generated types 갱신 시 이 façade 를 걷어내고 타입드
 * `.from()` 으로 되돌린다.
 *
 * ⚠️ 서버 전용. no-explicit-any 회피 위해 사용하는 메서드만 좁게 선언.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

interface PgError {
  message: string;
}

type ListResult<Row> = PromiseLike<{ data: Row[] | null; error: PgError | null }>;
type SingleResult<Row> = PromiseLike<{ data: Row | null; error: PgError | null }>;

export interface StoreQuery<Row> extends ListResult<Row> {
  select: (columns: string) => StoreQuery<Row>;
  eq: (column: string, value: string | number | boolean) => StoreQuery<Row>;
  in: (column: string, values: readonly (string | number)[]) => StoreQuery<Row>;
  order: (column: string, options?: { ascending?: boolean }) => StoreQuery<Row>;
  maybeSingle: () => SingleResult<Row>;
  insert: (values: Record<string, unknown>) => SingleResult<Row>;
}

/** generated types 에 아직 없는 store_ 테이블에 대한 untyped 쿼리 빌더. */
export function storeTable<Row>(client: SupabaseClient, table: string): StoreQuery<Row> {
  return (client as unknown as { from: (t: string) => StoreQuery<Row> }).from(table);
}

// ── 사용 컬럼만 담는 행 타입 ─────────────────────────────────────────────────
export interface StoreProductRow {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
}

export interface StoreVariantRow {
  id: string;
  name: string;
  sku: string;
  base_price: number;
  stock_qty: number;
}

export interface StorePriceTierRow {
  variant_id: string;
  min_qty: number;
  unit_price: number;
}
