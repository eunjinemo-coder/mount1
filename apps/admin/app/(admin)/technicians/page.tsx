import { getServerClient } from '@mount/db';
import { ForbiddenError, getSession, RedirectError, requireRole } from '@mount/lib';
import { Badge, Button, Card, CardContent } from '@mount/ui';
import { UserPlus } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import { AdminShell } from '../_layout/admin-shell';

export const metadata = { title: '협력기사' };

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

  const session = await getSession();
  const isSuperAdmin = session?.adminRole === 'super_admin';

  const client = await getServerClient();
  // PII 최소화 — phone 은 마스킹된 뒷자리 4 만 표시 (auditor 도 같이 노출되지 않도록)
  const { data } = await client
    .from('technicians')
    .select('id, login_id, display_name, phone, grade, status, daily_max_jobs, weekend_enabled')
    .order('display_name', { ascending: true });

  const technicians = (data ?? []).map((t) => ({
    ...t,
    phoneMasked: t.phone ? `***-****-${t.phone.slice(-4)}` : '-',
  }));

  return (
    <AdminShell activeNav="technicians" title="협력기사">
      <div className="mx-auto max-w-screen-2xl space-y-6 px-6 py-6">
        <header className="flex items-baseline justify-between">
          <div>
            <h2 className="text-2xl font-bold">협력기사</h2>
            <p className="text-muted-foreground text-sm">총 {technicians.length}명</p>
          </div>
          {isSuperAdmin ? (
            <Button asChild>
              <Link href="/technicians/new">
                <UserPlus className="mr-2 size-4" />
                신규 발급
              </Link>
            </Button>
          ) : null}
        </header>

        <Card>
          <CardContent className="pt-6">
            {technicians.length === 0 ? (
              <p className="text-muted-foreground text-sm">등록된 기사가 없습니다.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs uppercase tracking-wider">
                      <th className="text-muted-foreground px-2 py-3 text-left font-semibold">이름</th>
                      <th className="text-muted-foreground px-2 py-3 text-left font-semibold">로그인 ID</th>
                      <th className="text-muted-foreground px-2 py-3 text-left font-semibold">전화</th>
                      <th className="text-muted-foreground px-2 py-3 text-left font-semibold">등급</th>
                      <th className="text-muted-foreground px-2 py-3 text-left font-semibold">상태</th>
                      <th className="text-muted-foreground px-2 py-3 text-left font-semibold">하루 한도</th>
                      <th className="text-muted-foreground px-2 py-3 text-left font-semibold">주말</th>
                      {isSuperAdmin ? <th className="px-2 py-3 text-right" /> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {technicians.map((t) => {
                      const rowContent = (
                        <>
                          <td className="px-2 py-3 font-medium">{t.display_name}</td>
                          <td className="text-muted-foreground px-2 py-3 font-mono text-xs">{t.login_id}</td>
                          <td className="text-muted-foreground px-2 py-3 tabular-nums">{t.phoneMasked}</td>
                          <td className="px-2 py-3">
                            <Badge variant="outline">{GRADE_LABEL[t.grade ?? ''] ?? t.grade}</Badge>
                          </td>
                          <td className="px-2 py-3">
                            <Badge variant={t.status === 'active' ? 'default' : 'secondary'}>
                              {STATUS_LABEL[t.status ?? ''] ?? t.status}
                            </Badge>
                          </td>
                          <td className="text-muted-foreground px-2 py-3 tabular-nums">{t.daily_max_jobs ?? '-'}</td>
                          <td className="text-muted-foreground px-2 py-3">{t.weekend_enabled ? '✓' : '-'}</td>
                          {isSuperAdmin ? (
                            <td className="px-2 py-3 text-right">
                              <Link
                                className="text-primary hover:bg-primary/5 inline-flex items-center rounded px-2 py-1 text-xs font-medium hover:underline"
                                href={`/technicians/${t.id}`}
                              >
                                상세 →
                              </Link>
                            </td>
                          ) : null}
                        </>
                      );
                      return (
                        <tr className="hover:bg-muted/40 border-b transition-colors last:border-0" key={t.id}>
                          {rowContent}
                        </tr>
                      );
                    })}
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
