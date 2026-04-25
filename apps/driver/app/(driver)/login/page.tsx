import { getSession, toSafeRedirectPath } from '@mount/lib';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import { LoginForm } from './login-form';

export const metadata = {
  title: '기사 로그인',
};

export default async function LoginPage(props: {
  searchParams: Promise<{ error?: string; redirect?: string }>;
}): Promise<ReactElement> {
  const [{ error, redirect: redirectParam }, session] = await Promise.all([
    props.searchParams,
    getSession(),
  ]);
  const safeRedirect = toSafeRedirectPath(redirectParam);

  if (session?.userType === 'technician') {
    redirect(safeRedirect ?? '/');
  }

  return (
    <main className="bg-background min-h-dvh px-4">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center py-10">
        <h1 className="mb-6 text-2xl font-bold">마운트파트너스 기사앱</h1>
        <LoginForm error={error} redirect={safeRedirect} />
      </div>
    </main>
  );
}
