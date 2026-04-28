import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * RPC 호출 헬퍼.
 *
 * 새 RPC 가 supabase migrations 에 추가됐지만 dev DB 에 아직 push 되지 않은 시점에는
 * `types.generated.ts` 의 Functions union 에 RPC 이름이 포함되지 않아 strict 타입체크가 실패한다.
 * 이 헬퍼는 RPC 이름을 string 으로 받아 일시 우회하며, push 후
 * `pnpm --filter @mount/db db:types:dev` 재실행하면 정상 타입으로 다시 좁혀진다.
 *
 * ⚠️ this 보존 — supabase-js 의 `client.rpc` 는 인스턴스 메서드라 단순 destructure
 * (`const rpcFn = client.rpc`) 시 this 컨텍스트 손실 → "Cannot read properties of undefined
 * (reading 'rest')" 런타임 에러. `.call(client, ...)` 로 명시 바인딩하거나 메서드 직접 호출.
 */
export async function callRpc<TResult = unknown>(
  client: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
): Promise<{ data: TResult | null; error: { message: string } | null }> {
  // `client.rpc(name, args)` 직접 호출 — this 가 client 로 자동 바인딩
  // 타입은 generated Functions union 우회를 위해 unknown 경유
  const result = (await (client.rpc as unknown as (
    n: string,
    a: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>).call(
    client,
    name,
    args,
  )) as { data: TResult | null; error: { message: string } | null };

  return result;
}
