import { ForbiddenError, RedirectError, requireRole } from '@mount/lib';
import { Card, CardContent, CardHeader, CardTitle } from '@mount/ui';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import { DriverShell } from '../_layout/driver-shell';

export const metadata = { title: '정산' };

export default async function PayoutPage(): Promise<ReactElement> {
  try {
    await requireRole(['technician']);
  } catch (error) {
    if (error instanceof RedirectError) redirect('/login?redirect=/payout');
    if (error instanceof ForbiddenError) redirect('/login?error=forbidden');
    throw error;
  }

  return (
    <DriverShell activeTab="payout">
      <div className="mx-auto max-w-screen-md space-y-4 px-4 py-6">
        <h1 className="text-2xl font-bold">정산</h1>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">R5 작업 예정</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm leading-6">
            월별 시공 건수 + 정산금액 + CSV 내보내기 + 본사 정산 알림은 다음 라운드(R5)에서 구현
            예정입니다.
          </CardContent>
        </Card>
      </div>
    </DriverShell>
  );
}
