import { getSession } from '@mount/lib';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import { AdminLoginForm } from './login-form';

export const metadata = {
  title: '관리자 로그인',
};

function toSafeRedirectPath(value?: string): string | undefined {
  if (!value) return undefined;
  return value.startsWith('/') && !value.startsWith('//') ? value : undefined;
}

export default async function AdminLoginPage(props: {
  searchParams: Promise<{ error?: string; redirect?: string }>;
}): Promise<ReactElement> {
  const [{ error, redirect: redirectParam }, session] = await Promise.all([
    props.searchParams,
    getSession(),
  ]);
  const safeRedirect = toSafeRedirectPath(redirectParam);

  if (session?.userType === 'admin') {
    redirect(safeRedirect ?? '/');
  }

  return (
    <main className="bg-muted grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-md">
        <h1 className="mb-2 text-center text-2xl font-bold">마운트파트너스 관리자</h1>
        <p className="text-muted-foreground mb-6 text-center text-sm">
          허가된 IP에서만 접근 가능합니다.
        </p>
        <AdminLoginForm error={error} redirect={safeRedirect} />
      </div>
    </main>
  );
}
