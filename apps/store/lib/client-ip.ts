import { headers } from 'next/headers';

/**
 * 신뢰 가능한 클라이언트 IP 추출.
 *
 * Vercel/프록시 뒤에서는 `x-forwarded-for` 의 leftmost 값이 클라이언트가 헤더로
 * 위조 가능(요청마다 랜덤 IP 주입 → rate-limit 버킷 우회)하므로 신뢰하지 않는다.
 * 플랫폼(Vercel)이 직접 세팅하는 `x-real-ip` 를 우선한다.
 *
 * 주의: 서버 액션의 IP rate-limit 은 in-memory 라 서버리스 다중 인스턴스에서
 * 완전한 방어가 아니다. 실효 rate-limit(SMS 비용폭탄 차단)은 R4 에서 edge/Upstash
 * + create/lookup RPC 쿼터로 강제해야 한다. (red-team R3 H1/M1)
 */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const real = h.get('x-real-ip')?.trim();
  if (real) return real;
  // 폴백: XFF 는 신뢰도가 낮으므로 real-ip 부재 시에만 leftmost 사용
  const fwd = h.get('x-forwarded-for');
  const first = fwd?.split(',')[0]?.trim();
  return first || 'unknown';
}
