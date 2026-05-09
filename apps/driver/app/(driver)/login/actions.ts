'use server';

import { getServerClient } from '@mount/db';
import type { SignInResult } from '@mount/lib';

// 임시 디버깅 모드 — 베타 진단 후 원복
export async function loginAction(formData: FormData): Promise<SignInResult> {
  const username = String(formData.get('username') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!username || !password) {
    return { ok: false, error: '아이디와 비밀번호를 입력해 주세요.' };
  }

  const fakeEmail = `technician_${username}@mountpartners.cloud`;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

  // env 누락 체크
  if (!url || !anon) {
    return {
      ok: false,
      error: `[DEBUG] env 누락: url=${url ? 'OK(' + url.slice(0, 35) + ')' : 'EMPTY'}, anon=${anon ? 'OK(' + anon.length + ')' : 'EMPTY'}`,
    };
  }

  try {
    const client = await getServerClient();
    const { data, error } = await client.auth.signInWithPassword({
      email: fakeEmail,
      password,
    });

    if (error) {
      return {
        ok: false,
        error: `[DEBUG] email=${fakeEmail} | status=${error.status} | code=${error.code} | msg=${error.message} | url=${url.slice(0, 40)}`,
      };
    }

    if (!data.session) {
      return {
        ok: false,
        error: `[DEBUG] session 없음 | email=${fakeEmail} | url=${url.slice(0, 40)}`,
      };
    }

    return { ok: true, redirect: '/' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: `[DEBUG] throw: ${msg} | url=${url.slice(0, 40)}`,
    };
  }
}
