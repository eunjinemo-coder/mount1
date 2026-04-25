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
    <AdminShell activeNav="live" title="Live">
      <div className="mx-auto max-w-screen-2xl space-y-6 px-6 py-6">
        <h2 className="text-2xl font-bold">실시간 현황 (지도)</h2>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">R5 작업 예정</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm leading-6">
            Kakao Maps + 기사 마커 (last_known_lat/lng) + 주문 핀 + Realtime 구독은 다음 라운드(R5)에서
            구현 예정입니다.
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
