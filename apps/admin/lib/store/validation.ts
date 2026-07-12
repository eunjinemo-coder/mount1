/**
 * store 코어용 순수 입력검증 유틸.
 *
 * @mount/lib 의 isValidUuid 는 auth/asserts 에 있고, 그 배럴(index)이 next/headers 를
 * 전이 import 한다 → 순수 node 단위테스트 환경에서 부담. 코어(payment/shipment)는 이 로컬
 * 순수 유틸만 써서 테스트를 서버런타임과 격리한다(로직은 동일한 RFC4122 검사).
 */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string | null | undefined): boolean {
  return typeof value === 'string' && UUID_RE.test(value);
}
