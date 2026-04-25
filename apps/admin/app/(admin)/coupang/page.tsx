import { ForbiddenError, RedirectError, requireRole } from '@mount/lib';
import { Card, CardContent, CardHeader, CardTitle } from '@mount/ui';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import { AdminShell } from '../_layout/admin-shell';

export const metadata = { title: 'Coupang' };

export default async function CoupangPage(): Promise<ReactElement> {
  try {
    await requireRole({ adminRoles: ['super_admin', 'ops_admin'] });
  } catch (error) {
    if (error instanceof RedirectError) redirect('/login?redirect=/coupang');
    if (error instanceof ForbiddenError) redirect('/login?error=forbidden');
    throw error;
  }

  return (
    <AdminShell activeNav="coupang" title="Coupang">
      <div className="mx-auto max-w-screen-2xl space-y-6 px-6 py-6">
        <h2 className="text-2xl font-bold">쿠팡 ETL · 취소 리포트</h2>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">R5 작업 예정</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm leading-6">
            CSV 업로드 + coupang_order_staging 정규화 + 취소 리포트 일괄 전달은 다음 라운드(R5)에서
            구현 예정입니다.
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
