import { getServerClient } from '@mount/db';
import { ForbiddenError, RedirectError, requireRole } from '@mount/lib';
import { Card, CardContent, CardHeader, CardTitle } from '@mount/ui';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import { AdminShell } from '../_layout/admin-shell';
import { TransferTable, type PendingReport } from './transfer-table';

export const metadata = { title: 'Coupang' };

export default async function CoupangPage(): Promise<ReactElement> {
  try {
    await requireRole({ adminRoles: ['super_admin', 'ops_admin', 'cs_admin'] });
  } catch (error) {
    if (error instanceof RedirectError) redirect('/login?redirect=/coupang');
    if (error instanceof ForbiddenError) redirect('/login?error=forbidden');
    throw error;
  }

  const client = await getServerClient();
  const { data } = await client
    .from('cancellation_reports')
    .select(
      'id, order_id, category_primary, situation_note, created_at, technicians:technician_id(display_name)',
    )
    .eq('coupang_transfer_status', 'pending')
    .order('created_at', { ascending: true });

  const reports: PendingReport[] = (data ?? []).map((r) => {
    const tech = (r as unknown as { technicians?: { display_name?: string } }).technicians;
    return {
      id: r.id,
      order_id: r.order_id ?? '',
      category_primary: r.category_primary ?? 'etc',
      situation_note: r.situation_note ?? '',
      technician_name: tech?.display_name ?? null,
      created_at: r.created_at ?? new Date().toISOString(),
    };
  });

  return (
    <AdminShell activeNav="coupang" title="Coupang">
      <div className="mx-auto max-w-screen-2xl space-y-6 px-6 py-6">
        <header>
          <h2 className="text-2xl font-bold">쿠팡 ETL · 취소 리포트</h2>
          <p className="text-muted-foreground text-sm">
            취소 리포트 일괄 전달 + ETL 업로드 (CSV/XLSX 양식 정의 후 R10).
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">미전달 취소 리포트</CardTitle>
          </CardHeader>
          <CardContent>
            <TransferTable reports={reports} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">쿠팡 ETL 업로드 (R10 예정)</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm leading-6">
            CSV / XLSX / Sheets / Email 4 모드. 쿠팡 본사로부터 양식 확정 후 구현. 현재는 ETL
            스테이징 테이블이 ERD 에 정의만 되어 있으며 실제 import 흐름은 다음 라운드에서 작업.
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
