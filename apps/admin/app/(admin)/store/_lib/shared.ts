import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * store 어드민 화면(A1~A4) 공용 — DB 접근 헬퍼(서버 전용). 라벨맵·포맷터는 ./labels
 * 참조(client 컴포넌트도 import 하므로 여긴 순수 서버 코드만 둔다).
 *
 * store_* 테이블은 dev DB 마이그레이션(0021/0023) 적용 및 `supabase gen types` 실행 전까지
 * generated Database 타입에 없다(apps/admin/lib/store/notify-adapter.ts 의 loadOrderNo 와
 * 동일 상황). storeClient() 는 제네릭을 벗겨 테이블명 타입에러를 피하고, 각 호출부는 결과값을
 * 명시적 interface 로 재캐스팅해 사용한다(R4a orders/[id]/page.tsx 의 issues/events 캐스팅과
 * 동일 컨벤션). 리터럴 `any` 는 쓰지 않는다(eslint no-explicit-any).
 */
export function storeClient(client: SupabaseClient): SupabaseClient {
  return client as unknown as SupabaseClient;
}

/**
 * store_* 쿼리 안전 실행 — dev DB 미마이그레이션(relation 없음)·권한오류 등 어떤 실패든
 * throw 하지 않고 null 로 흡수한다. A1~A4 는 이 위에서 빈 상태를 렌더링해야 하므로
 * (팀리드 지시: "데이터 없을 때(pre-push) 빈 상태 안내") 페이지가 절대 크래시하지 않는다.
 */
export async function safeSelect<T>(
  query: PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T | null> {
  try {
    const { data, error } = await query;
    if (error) return null;
    return data as T | null;
  } catch {
    return null;
  }
}

/** count:'exact' 쿼리 전용 — safeSelect 와 동일한 실패흡수, count 만 뽑아 반환(기본 0). */
export async function safeCount(
  query: PromiseLike<{ count: number | null; error: { message: string } | null }>,
): Promise<number> {
  try {
    const { count, error } = await query;
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}
