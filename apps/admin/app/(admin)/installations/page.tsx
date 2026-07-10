import { getServerClient } from '@mount/db';
import { ForbiddenError, RedirectError, requireRole } from '@mount/lib';
import { Badge, Button, Card, CardContent } from '@mount/ui';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import { AdminShell } from '../_layout/admin-shell';

export const metadata = { title: '시공 관리' };

const STATUS_LABEL: Record<string, string> = {
  scheduled: '예정',
  in_progress: '진행중',
  completed: '완료',
  cancelled: '취소',
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  scheduled: 'outline',
  in_progress: 'default',
  completed: 'secondary',
  cancelled: 'destructive',
};

const FILTERS = [
  { id: 'upcoming', label: '예정' },
  { id: 'today', label: '오늘' },
  { id: 'all', label: '전체' },
] as const;

interface JobRow {
  id: string;
  scheduled_install_date: string | null;
  visit_time: string | null;
  customer_name: string | null;
  address: string | null;
  technician_name: string | null;
  status: string | null;
}

/** KST 오늘 날짜(YYYY-MM-DD). scheduled_install_date(date) 비교 기준. */
function kstToday(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

interface JobQuery extends PromiseLike<{ data: JobRow[] | null }> {
  select: (c: string) => JobQuery;
  eq: (c: string, v: string) => JobQuery;
  gte: (c: string, v: string) => JobQuery;
  order: (c: string, o: { ascending: boolean; nullsFirst: boolean }) => JobQuery;
  limit: (n: number) => JobQuery;
}

export default async function InstallationsPage(props: {
  searchParams: Promise<{ filter?: string }>;
}): Promise<ReactElement> {
  try {
    await requireRole(['admin']);
  } catch (error) {
    if (error instanceof RedirectError) redirect('/login?redirect=/installations');
    if (error instanceof ForbiddenError) redirect('/login?error=forbidden');
    throw error;
  }

  const { filter: filterParam } = await props.searchParams;
  const activeFilter = FILTERS.find((f) => f.id === filterParam) ?? FILTERS[0]!;
  const today = kstToday();

  const client = await getServerClient();
  let query = (client as unknown as { from: (t: string) => JobQuery })
    .from('installation_jobs')
    .select(
      'id, scheduled_install_date, visit_time, customer_name, address, technician_name, status',
    )
    .order('scheduled_install_date', { ascending: true, nullsFirst: false })
    .limit(200);

  if (activeFilter.id === 'today') query = query.eq('scheduled_install_date', today);
  else if (activeFilter.id === 'upcoming') query = query.gte('scheduled_install_date', today);

  const { data } = await query;
  const jobs = data ?? [];

  return (
    <AdminShell activeNav="installations" title="시공 관리">
      <div className="mx-auto max-w-screen-2xl space-y-6 px-6 py-6">
        <header className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">본사 시공</h2>
            <p className="text-muted-foreground text-sm">
              은진님 구글시트와 양방향 동기화되는 자가 시공건입니다.
            </p>
          </div>
          <Button asChild size="sm">
            <Link href="/installations/new">
              <Plus className="mr-1 size-4" aria-hidden />
              시공 등록
            </Link>
          </Button>
        </header>

        <nav className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Button
              asChild
              key={f.id}
              size="sm"
              variant={f.id === activeFilter.id ? 'default' : 'outline'}
            >
              <Link href={f.id === 'upcoming' ? '/installations' : `/installations?filter=${f.id}`}>
                {f.label}
              </Link>
            </Button>
          ))}
        </nav>

        <Card>
          <CardContent className="pt-6">
            {jobs.length === 0 ? (
              <p className="text-muted-foreground text-sm">조회된 시공이 없습니다.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs uppercase tracking-wider">
                      <th className="text-muted-foreground px-2 py-3 text-left font-semibold">시공일자</th>
                      <th className="text-muted-foreground px-2 py-3 text-left font-semibold">방문시간</th>
                      <th className="text-muted-foreground px-2 py-3 text-left font-semibold">성함</th>
                      <th className="text-muted-foreground px-2 py-3 text-left font-semibold">주소</th>
                      <th className="text-muted-foreground px-2 py-3 text-left font-semibold">담당자</th>
                      <th className="text-muted-foreground px-2 py-3 text-left font-semibold">상태</th>
                      <th className="px-2 py-3 text-right" />
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((job) => (
                      <tr
                        className="hover:bg-muted/40 border-b transition-colors last:border-0"
                        key={job.id}
                      >
                        <td className="px-2 py-3 font-medium tabular-nums">
                          {job.scheduled_install_date ?? '미정'}
                        </td>
                        <td className="text-muted-foreground px-2 py-3">{job.visit_time ?? '-'}</td>
                        <td className="px-2 py-3">{job.customer_name ?? '-'}</td>
                        <td className="text-muted-foreground max-w-xs truncate px-2 py-3">
                          {job.address ?? '-'}
                        </td>
                        <td className="px-2 py-3">
                          {job.technician_name ?? (
                            <span className="text-muted-foreground italic">미배정</span>
                          )}
                        </td>
                        <td className="px-2 py-3">
                          <Badge variant={STATUS_VARIANT[job.status ?? ''] ?? 'outline'}>
                            {STATUS_LABEL[job.status ?? ''] ?? job.status ?? '-'}
                          </Badge>
                        </td>
                        <td className="px-2 py-3 text-right">
                          <Link
                            className="text-primary hover:bg-primary/5 inline-flex items-center rounded px-2 py-1 text-xs font-medium hover:underline"
                            href={`/installations/${job.id}`}
                          >
                            상세 →
                          </Link>
                        </td>
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
