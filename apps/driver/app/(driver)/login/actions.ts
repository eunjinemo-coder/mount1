'use server';

import type { SignInResult } from '@mount/lib';
import { signInWithUsername } from '@mount/lib';

export async function loginAction(formData: FormData): Promise<SignInResult> {
  const username = String(formData.get('username') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!username || !password) {
    return { ok: false, error: '아이디와 비밀번호를 입력해 주세요.' };
  }

  try {
    return await signInWithUsername({
      username,
      password,
      userType: 'technician',
    });
  } catch {
    return {
      ok: false,
      error: '로그인 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.',
    };
  }
}
