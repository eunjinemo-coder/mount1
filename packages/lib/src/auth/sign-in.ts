import { getServerClient } from '@mount/db';

export type AdminRole =
  | 'super_admin'
  | 'cs_admin'
  | 'dispatch_admin'
  | 'ops_admin'
  | 'auditor';

export type UserType = 'admin' | 'technician';

export interface SignInResult {
  ok: boolean;
  error?: string;
  redirect?: string;
}

function toFakeEmail(args: {
  username: string;
  userType: UserType;
  adminRoleHint?: AdminRole;
}): string {
  if (args.userType === 'admin') {
    return `${args.adminRoleHint ?? 'cs_admin'}_${args.username}@internal.mountpartners.cloud`;
  }

  return `technician_${args.username}@internal.mountpartners.cloud`;
}

/** 발급형 ID 로그인 — username 을 fake email 로 변환 후 supabase.auth.signInWithPassword */
export async function signInWithUsername(args: {
  username: string;
  password: string;
  userType: UserType;
  adminRoleHint?: AdminRole;
}): Promise<SignInResult> {
  const client = await getServerClient();
  const { error } = await client.auth.signInWithPassword({
    email: toFakeEmail(args),
    password: args.password,
  });

  if (error) {
    console.error('[signInWithUsername] supabase error:', {
      status: error.status,
      code: error.code,
      message: error.message,
      name: error.name,
    });
    return {
      ok: false,
      error: '아이디 또는 비밀번호가 올바르지 않습니다.',
    };
  }

  return {
    ok: true,
    redirect: args.userType === 'admin' ? '/admin' : '/',
  };
}
