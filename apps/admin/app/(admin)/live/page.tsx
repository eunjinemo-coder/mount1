import { ForbiddenError, RedirectError, requireRole } from '@mount/lib';
import { Card, CardContent, CardHeader, CardTitle } from '@mount/ui';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import { AdminShell } from '../_layout/admin-shell';

export const metadata = { title: 'Live' };

export default async function LivePage(): Promise<ReactElement> {
  try {
    await requireRole(['admin']);
  } catch (error) {
    if (error instanceof RedirectError) redirect('/login?redirect=/live');
    if (error instanceof ForbiddenError) redirect('/login?error=forbidden');
    throw error;
  }

  return (
    <AdminShell activeNav="live" title="실시간 현황판">
      <div className="mx-auto max-w-screen-2xl space-y-6 px-6 py-6">
        <h2 className="text-2xl font-bold">실시간 현황 (지도)</h2>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">준비 중</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm leading-6">
            지도 위에서 기사 위치와 시공 핀을 실시간으로 보여드릴 예정입니다.
            지도 키 발급 후 곧 연결돼요.
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
