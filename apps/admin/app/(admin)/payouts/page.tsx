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
    <AdminShell activeNav="payouts" title="정산 / 결제">
      <div className="mx-auto max-w-screen-2xl space-y-6 px-6 py-6">
        <header>
          <h2 className="text-2xl font-bold">정산 / 결제</h2>
          <p className="text-muted-foreground text-sm">
            기간을 선택해 기사별 시공 집계를 엑셀 파일로 내려받을 수 있어요.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">기사 정산 다운로드</CardTitle>
          </CardHeader>
          <CardContent>
            <PayoutCsvForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">결제 링크 (준비 중)</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm leading-6">
            결제 시스템 연결이 끝나면 이 화면에서 결제 링크를 보내고 상태를 추적할 수 있어요.
            현재는 결제 대기 주문은 카카오톡 채널로 직접 안내해 주세요.
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
