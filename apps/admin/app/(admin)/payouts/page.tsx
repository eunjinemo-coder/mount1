import { ForbiddenError, RedirectError, requireRole } from '@mount/lib';
import { Card, CardContent, CardHeader, CardTitle } from '@mount/ui';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import { AdminShell } from '../_layout/admin-shell';
import { PayoutCsvForm } from './payout-csv-form';

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
        <header>
          <h2 className="text-2xl font-bold">정산 · 결제</h2>
          <p className="text-muted-foreground text-sm">
            기간별 기사 시공 집계 CSV 다운로드 + 결제 링크 (B07 다음 라운드).
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">기사 정산 CSV</CardTitle>
          </CardHeader>
          <CardContent>
            <PayoutCsvForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">결제 링크 (B07 R10 예정)</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm leading-6">
            PortOne 가맹점 가입 + Webhook 연결 후 이 화면에서 옵션B 결제링크 발송 + 상태 추적.
            현재는 awaiting_payment 주문에 대해 본사 카카오톡 채널로 수기 발송.
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
