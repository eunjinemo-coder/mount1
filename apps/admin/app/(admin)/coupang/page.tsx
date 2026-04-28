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
    <AdminShell activeNav="coupang" title="쿠팡 정산">
      <div className="mx-auto max-w-screen-2xl space-y-6 px-6 py-6">
        <header>
          <h2 className="text-2xl font-bold">쿠팡 정산 · 취소 보고</h2>
          <p className="text-muted-foreground text-sm">
            현장 취소 보고서를 쿠팡 측에 일괄 전달하고, 주문 데이터를 가져옵니다.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">전달 대기 중인 취소 보고서</CardTitle>
          </CardHeader>
          <CardContent>
            <TransferTable reports={reports} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">쿠팡 주문 가져오기 (준비 중)</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm leading-6">
            엑셀(CSV/XLSX) 파일 업로드 또는 메일 자동 가져오기를 곧 지원합니다.
            쿠팡 본사 양식 확정 후 연결됩니다.
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
