import { getServerClient } from '@mount/db';
import { ForbiddenError, RedirectError, requireRole } from '@mount/lib';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@mount/ui';
import { Plane } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import { DriverShell } from '../_layout/driver-shell';
import { VacationForm } from './vacation-form';

export const metadata = { title: '휴가 등록' };

const DATE = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  weekday: 'short',
  timeZone: 'Asia/Seoul',
});

export default async function AvailabilityPage(): Promise<ReactElement> {
  let session;
  try {
    session = await requireRole(['technician']);
  } catch (error) {
    if (error instanceof RedirectError) redirect('/login?redirect=/availability');
    if (error instanceof ForbiddenError) redirect('/login?error=forbidden');
    throw error;
  }

  const client = await getServerClient();

  // 미래 휴가만 표시
  const today = new Date().toISOString().slice(0, 10);
  const { data: vacations } = await client
    .from('technician_vacations')
    .select('id, start_date, end_date, reason')
    .eq('technician_id', session.technicianId ?? '')
    .gte('end_date', today)
    .order('start_date', { ascending: true });

  return (
    <DriverShell>
      <div className="mx-auto max-w-screen-md space-y-4 px-4 py-6">
        <header>
          <Link className="text-muted-foreground text-sm" href="/calendar">
            ← 캘린더로
          </Link>
          <h1 className="mt-2 text-2xl font-bold">휴가 등록</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            등록한 기간에는 자동 배차에서 제외됩니다.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">새 휴가 등록</CardTitle>
          </CardHeader>
          <CardContent>
            <VacationForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plane className="size-4" aria-hidden />
              예정된 휴가 ({vacations?.length ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!vacations || vacations.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-sm">
                등록된 휴가가 없어요.
              </p>
            ) : (
              <ul className="space-y-2">
                {vacations.map((v) => {
                  const start = DATE.format(new Date(v.start_date as unknown as string));
                  const end = DATE.format(new Date(v.end_date as unknown as string));
                  return (
                    <li
                      key={v.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2.5"
                    >
                      <div>
                        <p className="font-medium text-sm">
                          {start} ~ {end}
                        </p>
                        {v.reason ? (
                          <p className="text-muted-foreground text-xs">{v.reason}</p>
                        ) : null}
                      </div>
                      <Badge variant="outline">
                        {Math.max(
                          1,
                          Math.ceil(
                            (new Date(v.end_date as unknown as string).getTime() -
                              new Date(v.start_date as unknown as string).getTime()) /
                              (24 * 60 * 60 * 1000),
                          ) + 1,
                        )}
                        일
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <p className="text-muted-foreground text-center text-xs leading-6">
          이미 시작된 휴가는 본사 카카오톡 채널로 문의해 주세요.
          <br />
          주말 시공 가능 여부는 설정에서 변경 가능합니다.
        </p>
      </div>
    </DriverShell>
  );
}
