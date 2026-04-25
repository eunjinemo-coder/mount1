'use server';

import type { AdminRole, SignInResult } from '@mount/lib';
import { signInWithUsername } from '@mount/lib';

const ADMIN_ROLES: readonly AdminRole[] = [
  'super_admin',
  'cs_admin',
  'dispatch_admin',
  'ops_admin',
  'auditor',
];

function parseAdminRole(value: unknown): AdminRole {
  if (typeof value === 'string' && (ADMIN_ROLES as readonly string[]).includes(value)) {
    return value as AdminRole;
  }
  return 'cs_admin';
}

export async function adminLoginAction(formData: FormData): Promise<SignInResult> {
  const username = String(formData.get('username') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const adminRole = parseAdminRole(formData.get('adminRole'));

  if (!username || !password) {
    return { ok: false, error: '아이디와 비밀번호를 입력해 주세요.' };
  }

  try {
    return await signInWithUsername({
      username,
      password,
      userType: 'admin',
      adminRoleHint: adminRole,
    });
  } catch {
    return {
      ok: false,
      error: '로그인 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.',
    };
  }
}
