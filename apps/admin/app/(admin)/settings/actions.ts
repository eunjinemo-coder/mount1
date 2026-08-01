'use server';

/**
 * 설정 — 비밀번호 변경(본인).
 *
 * 이 앱의 로그인은 실제 이메일이 아니라 "역할_아이디@mountpartners.cloud" 가짜 이메일이라
 * 메일 발송형 재설정(reset password email)이 성립하지 않는다. 대신 **로그인 상태에서
 * 현재 비밀번호 재확인 후 변경**하는 경로를 제공한다(대표가 대시보드를 열 필요 없음).
 *
 * 보안:
 *   · 현재 비밀번호 재확인(세션 탈취 상태에서의 비밀번호 탈취 방지)
 *   · 최소 길이 검증. 실패 사유는 뭉뚱그려 반환(계정 존재/형식 추론 차단)
 */
import { getServerClient } from '@mount/db';
import { getSession } from '@mount/lib';

const MIN_LENGTH = 8;

export interface ChangePasswordResult {
  ok: boolean;
  error?: string;
}

export async function changeMyPasswordAction(
  currentPassword: string,
  newPassword: string,
): Promise<ChangePasswordResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: '로그인이 필요합니다.' };

  const current = currentPassword ?? '';
  const next = newPassword ?? '';
  if (current.length === 0 || next.length === 0) {
    return { ok: false, error: '현재 비밀번호와 새 비밀번호를 모두 입력해 주세요.' };
  }
  if (next.length < MIN_LENGTH) {
    return { ok: false, error: `새 비밀번호는 ${MIN_LENGTH}자 이상이어야 합니다.` };
  }
  if (next === current) {
    return { ok: false, error: '현재 비밀번호와 다른 값을 사용해 주세요.' };
  }

  const client = await getServerClient();

  // 현재 사용자 이메일(가짜 이메일) 확보 — 재인증에 필요
  const { data: userData } = await client.auth.getUser();
  const email = userData.user?.email;
  if (!email) return { ok: false, error: '세션이 만료되었습니다. 다시 로그인해 주세요.' };

  // 현재 비밀번호 재확인(같은 계정으로 재로그인 — 세션 쿠키는 동일 사용자로 갱신)
  const { error: reauthError } = await client.auth.signInWithPassword({ email, password: current });
  if (reauthError) return { ok: false, error: '현재 비밀번호가 올바르지 않습니다.' };

  const { error: updateError } = await client.auth.updateUser({ password: next });
  if (updateError) {
    console.error('[changeMyPassword] update 실패:', updateError.message);
    return { ok: false, error: '비밀번호 변경에 실패했습니다. 잠시 후 다시 시도해 주세요.' };
  }

  return { ok: true };
}
