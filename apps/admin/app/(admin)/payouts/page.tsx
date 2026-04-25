import { ForbiddenError, RedirectError, requireRole } from '@mount/lib';
import { Card, CardContent, CardHeader, CardTitle } from '@mount/ui';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import { AdminShell } from '../_layout/admin-shell';

export const metadata = { title: 'Payouts' };

export default async function PayoutsPage(): Promise<ReactElement> {
  try {
    await requireRole({ adminRoles: ['super_admin', 'cs_admin', 'ops_admin'] });
  } catch (error) {
    if (error instanceof RedirectError) redirect('/login?redirect=/payouts');
    if (error instanceof ForbiddenError) redirect('/login?error=forbidden');
    throw error;
  }

  return (
    <AdminShell activeNav="payouts" title="Payouts">
      <div className="mx-auto max-w-screen-2xl space-y-6 px-6 py-6">
        <h2 className="text-2xl font-bold">정산 · 결제</h2>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">R5 작업 예정</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm leading-6">
            기사 월별 정산 CSV + 결제링크 발송 이력 + PortOne 웹훅 검증 통합은 다음 라운드(R5)에서
            구현 예정입니다.
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
