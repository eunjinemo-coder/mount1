import { getServerClient } from '@mount/db';
import { ForbiddenError, RedirectError, requireRole } from '@mount/lib';
import { Badge, Card, CardContent } from '@mount/ui';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import { AdminShell } from '../_layout/admin-shell';

export const metadata = { title: 'Technicians' };

const GRADE_LABEL: Record<string, string> = {
  gold: '골드',
  silver: '실버',
  bronze: '브론즈',
};

const STATUS_LABEL: Record<string, string> = {
  active: '활성',
  paused: '휴직',
  terminated: '계약 종료',
};

export default async function TechniciansPage(): Promise<ReactElement> {
  try {
    await requireRole(['admin']);
  } catch (error) {
    if (error instanceof RedirectError) redirect('/login?redirect=/technicians');
    if (error instanceof ForbiddenError) redirect('/login?error=forbidden');
    throw error;
  }

  const client = await getServerClient();
  const { data } = await client
    .from('technicians')
    .select('id, login_id, display_name, phone, grade, status, daily_max_jobs, weekend_enabled')
    .order('display_name', { ascending: true });

  const technicians = data ?? [];

  return (
    <AdminShell activeNav="technicians" title="Technicians">
      <div className="mx-auto max-w-screen-2xl space-y-6 px-6 py-6">
        <header>
          <h2 className="text-2xl font-bold">협력기사</h2>
          <p className="text-muted-foreground text-sm">총 {technicians.length}명 · 발급·잠금 해제는 R5 추가</p>
        </header>

        <Card>
          <CardContent className="pt-6">
            {technicians.length === 0 ? (
              <p className="text-muted-foreground text-sm">등록된 기사가 없습니다.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="py-2 text-left font-medium">이름</th>
                      <th className="py-2 text-left font-medium">로그인 ID</th>
                      <th className="py-2 text-left font-medium">전화</th>
                      <th className="py-2 text-left font-medium">등급</th>
                      <th className="py-2 text-left font-medium">상태</th>
                      <th className="py-2 text-left font-medium">일 한도</th>
                      <th className="py-2 text-left font-medium">주말</th>
                    </tr>
                  </thead>
                  <tbody>
                    {technicians.map((t) => (
                      <tr className="border-b last:border-0" key={t.id}>
                        <td className="py-2 font-medium">{t.display_name}</td>
                        <td className="text-muted-foreground py-2 text-xs">{t.login_id}</td>
                        <td className="text-muted-foreground py-2">{t.phone}</td>
                        <td className="py-2">
                          <Badge variant="outline">{GRADE_LABEL[t.grade ?? ''] ?? t.grade}</Badge>
                        </td>
                        <td className="py-2">
                          <Badge variant={t.status === 'active' ? 'default' : 'secondary'}>
                            {STATUS_LABEL[t.status ?? ''] ?? t.status}
                          </Badge>
                        </td>
                        <td className="text-muted-foreground py-2">{t.daily_max_jobs ?? '-'}</td>
                        <td className="text-muted-foreground py-2">{t.weekend_enabled ? '✓' : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
