import { ForbiddenError, RedirectError, requireRole, signOut } from '@mount/lib';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@mount/ui';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import { DriverShell } from '../_layout/driver-shell';

export const metadata = { title: '설정' };

async function handleSignOut(): Promise<void> {
  'use server';
  await signOut();
  redirect('/login');
}

export default async function SettingsPage(): Promise<ReactElement> {
  let session;
  try {
    session = await requireRole(['technician']);
  } catch (error) {
    if (error instanceof RedirectError) redirect('/login?redirect=/settings');
    if (error instanceof ForbiddenError) redirect('/login?error=forbidden');
    throw error;
  }

  return (
    <DriverShell>
      <div className="mx-auto max-w-screen-md space-y-4 px-4 py-6">
        <h1 className="text-2xl font-bold">설정</h1>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">계정</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground space-y-2 text-sm">
            <p>로그인 ID: <code className="bg-muted text-foreground rounded px-1">{session.userId.slice(0, 12)}...</code></p>
            <p>비밀번호 분실 시 본사 카카오톡 채널로 재발급 요청해 주세요.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">알림 동의</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm leading-6">
            푸시·SMS·알림톡 동의 토글은 R5 작업에서 추가 예정입니다.
          </CardContent>
        </Card>

        <form action={handleSignOut}>
          <Button className="w-full" size="lg" type="submit" variant="outline">
            로그아웃
          </Button>
        </form>

        <p className="text-muted-foreground pt-2 text-center text-xs">v0.1.0 · © 2026 MountPartners</p>
      </div>
    </DriverShell>
  );
}
