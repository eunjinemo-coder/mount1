import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * RPC 호출 헬퍼.
 *
 * 새 RPC 가 supabase migrations 에 추가됐지만 dev DB 에 아직 push 되지 않은 시점에는
 * `types.generated.ts` 의 Functions union 에 RPC 이름이 포함되지 않아 strict 타입체크가 실패한다.
 * 이 헬퍼는 RPC 이름을 string 으로 받아 일시 우회하며, 0005_rpc.sql 등 push 후
 * `pnpm --filter @mount/db db:types:dev` 재실행하면 정상 타입으로 다시 좁혀진다.
 *
 * 호출부에서 결과 페이로드 타입은 제네릭 TResult 로 명시.
 */
export async function callRpc<TResult = unknown>(
  client: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
): Promise<{ data: TResult | null; error: { message: string } | null }> {
  const rpcFn = client.rpc as unknown as (
    n: string,
    a: Record<string, unknown>,
  ) => Promise<{ data: TResult | null; error: { message: string } | null }>;
  return rpcFn(name, args);
}
