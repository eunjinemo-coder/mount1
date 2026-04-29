import { webcrypto } from 'node:crypto';
import type { AdminRole } from './sign-in';
import { ForbiddenError, requireRole } from './require-role';
import { getSession, type AppSession } from './session';

/**
 * 공통 보안/검증 헬퍼.
 *
 * 발견 배경: code-reviewer 에이전트 점검 결과 6 actions.ts 가 UUID_RE 를 인라인 중복 정의,
 * 4 actions.ts 가 세션 가드 누락, technicians/new 가 Math.random() 으로 비밀번호 생성.
 * 본 모듈은 단일 원천으로 보안 검증을 일원화한다.
 */

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string | null | undefined): boolean {
  return typeof value === 'string' && UUID_RE.test(value);
}

/**
 * 관리자 역할 검증 — 허용 role 중 하나여야 통과.
 * 미인증 시 RedirectError, 권한 부족 시 ForbiddenError throw.
 *
 * 사용:
 *   await assertAdminRole(['super_admin', 'cs_admin']);
 *   // 통과 후 mutation 진행
 */
export async function assertAdminRole(allowed: readonly AdminRole[]): Promise<AppSession> {
  return requireRole({ adminRoles: [...allowed] });
}

/**
 * 기사 세션 검증 — technicianId 필수.
 * 미인증 시 ForbiddenError throw, technician 이 아니면 ForbiddenError.
 *
 * 사용:
 *   const session = await assertTechnicianSession();
 *   // session.technicianId 보장됨
 */
export async function assertTechnicianSession(): Promise<AppSession & { technicianId: string }> {
  const session = await getSession();
  if (!session?.technicianId) {
    throw new ForbiddenError('technician_session_required');
  }
  return session as AppSession & { technicianId: string };
}

/**
 * CSPRNG 기반 강한 임시 비밀번호 생성 (12자, 대·소·숫자·특수 각 1자+ 보장).
 * Math.random() 은 비암호학적 — 사용 금지.
 *
 * 사용 케이스: 협력기사 / 관리자 신규 발급 시 임시 비밀번호.
 */
export function generateSecurePassword(): string {
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digit = '23456789';
  const symbol = '!@#$%&*';
  const all = lower + upper + digit + symbol;

  const buf = new Uint32Array(12);
  webcrypto.getRandomValues(buf);

  // 4 카테고리에서 1자씩 보장
  const required = [
    lower[buf[0]! % lower.length] ?? 'a',
    upper[buf[1]! % upper.length] ?? 'A',
    digit[buf[2]! % digit.length] ?? '2',
    symbol[buf[3]! % symbol.length] ?? '!',
  ];

  // 나머지 8자 임의
  const fill: string[] = [];
  for (let i = 4; i < 12; i += 1) {
    fill.push(all[buf[i]! % all.length] ?? 'x');
  }

  // Fisher-Yates shuffle (CSPRNG)
  const combined = [...required, ...fill];
  const shuffleBuf = new Uint32Array(combined.length);
  webcrypto.getRandomValues(shuffleBuf);
  for (let i = combined.length - 1; i > 0; i -= 1) {
    const j = shuffleBuf[i]! % (i + 1);
    [combined[i], combined[j]] = [combined[j]!, combined[i]!];
  }

  return combined.join('');
}
