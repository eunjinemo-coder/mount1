import { getServerClient } from '@mount/db';
import { ForbiddenError, RedirectError, requireRole } from '@mount/lib';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@mount/ui';
import { CalendarDays, Plane } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import { DriverShell } from '../_layout/driver-shell';

export const metadata = { title: '예약 캘린더' };

const KOREAN_DAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

interface DayCell {
  date: Date;
  inMonth: boolean;
  count: number;
}

function buildMonthGrid(year: number, month: number): DayCell[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startWeekday = first.getDay();
  const daysInMonth = last.getDate();

  const cells: DayCell[] = [];

  // 이전 달 잔여
  const prevLast = new Date(year, month, 0).getDate();
  for (let i = startWeekday - 1; i >= 0; i -= 1) {
    cells.push({ date: new Date(year, month - 1, prevLast - i), inMonth: false, count: 0 });
  }
  // 현재 달
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push({ date: new Date(year, month, d), inMonth: true, count: 0 });
  }
  // 다음 달 채움 (총 6주 42칸)
  while (cells.length < 42) {
    const lastCell = cells[cells.length - 1]!.date;
    cells.push({
      date: new Date(lastCell.getFullYear(), lastCell.getMonth(), lastCell.getDate() + 1),
      inMonth: false,
      count: 0,
    });
  }
  return cells;
}

function formatYM(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default async function CalendarPage(props: {
  searchParams: Promise<{ ym?: string }>;
}): Promise<ReactElement> {
  let session;
  try {
    session = await requireRole(['technician']);
  } catch (error) {
    if (error instanceof RedirectError) redirect('/login?redirect=/calendar');
    if (error instanceof ForbiddenError) redirect('/login?error=forbidden');
    throw error;
  }

  const { ym } = await props.searchParams;
  const now = new Date();
  const target = ym && /^\d{4}-\d{2}$/.test(ym)
    ? new Date(Number(ym.split('-')[0]), Number(ym.split('-')[1]) - 1, 1)
    : new Date(now.getFullYear(), now.getMonth(), 1);

  const monthStart = new Date(target.getFullYear(), target.getMonth(), 1);
  const monthEnd = new Date(target.getFullYear(), target.getMonth() + 1, 0, 23, 59, 59);

  const client = await getServerClient();

  // 본인 배차 주문 (해당 월)
  const { data: orders } = await client
    .from('orders')
    .select('id, scheduled_installation_at, status')
    .eq('assigned_technician_id', session.technicianId ?? '')
    .gte('scheduled_installation_at', monthStart.toISOString())
    .lte('scheduled_installation_at', monthEnd.toISOString());

  // 휴가 (해당 월에 겹치는 것) — start_date <= 월말 AND end_date >= 월초
  const monthStartDate = monthStart.toISOString().slice(0, 10);
  const monthEndDate = monthEnd.toISOString().slice(0, 10);
  const { data: vacations } = await client
    .from('technician_vacations')
    .select('start_date, end_date, reason')
    .eq('technician_id', session.technicianId ?? '')
    .lte('start_date', monthEndDate)
    .gte('end_date', monthStartDate);

  // 일자별 카운트 + 휴가 표시
  const cells = buildMonthGrid(target.getFullYear(), target.getMonth());
  const orderCountByDay = new Map<string, number>();
  for (const o of orders ?? []) {
    if (!o.scheduled_installation_at) continue;
    const d = new Date(o.scheduled_installation_at);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    orderCountByDay.set(key, (orderCountByDay.get(key) ?? 0) + 1);
  }
  for (const cell of cells) {
    const key = `${cell.date.getFullYear()}-${cell.date.getMonth()}-${cell.date.getDate()}`;
    cell.count = orderCountByDay.get(key) ?? 0;
  }

  const vacationDates = new Set<string>();
  const DAY_MS = 24 * 60 * 60 * 1000;
  for (const v of vacations ?? []) {
    const start = new Date(v.start_date as unknown as string);
    const end = new Date(v.end_date as unknown as string);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
    // 시작일 자정 기준 ms 카운터로 안전 순회 — 원본 Date 변형 없음.
    const startMs = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
    const endMs = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
    for (let ms = startMs; ms <= endMs; ms += DAY_MS) {
      const d = new Date(ms);
      vacationDates.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }
  }

  const prevMonth = new Date(target.getFullYear(), target.getMonth() - 1, 1);
  const nextMonth = new Date(target.getFullYear(), target.getMonth() + 1, 1);

  const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  const totalThisMonth = orders?.length ?? 0;

  return (
    <DriverShell>
      <div className="mx-auto max-w-screen-md space-y-4 px-4 py-6">
        <header className="flex items-baseline justify-between">
          <h1 className="text-2xl font-bold">예약 캘린더</h1>
          <Button asChild size="sm" variant="outline">
            <Link href="/availability">
              <Plane className="size-4" aria-hidden />
              휴가 등록
            </Link>
          </Button>
        </header>

        <Card>
          <CardHeader className="border-b pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <Button asChild size="sm" variant="ghost">
                <Link href={`/calendar?ym=${formatYM(prevMonth)}`}>← 이전</Link>
              </Button>
              <div className="flex flex-col items-center gap-0.5">
                <span className="font-bold">
                  {target.getFullYear()}년 {target.getMonth() + 1}월
                </span>
                <span className="text-muted-foreground text-xs font-normal">
                  이번 달 시공 {totalThisMonth}건
                </span>
              </div>
              <Button asChild size="sm" variant="ghost">
                <Link href={`/calendar?ym=${formatYM(nextMonth)}`}>다음 →</Link>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {KOREAN_DAYS.map((day, i) => (
                <div
                  key={day}
                  className={`text-muted-foreground py-2 font-semibold ${
                    i === 0 ? 'text-destructive' : i === 6 ? 'text-primary' : ''
                  }`}
                >
                  {day}
                </div>
              ))}
              {cells.map((cell, idx) => {
                const key = `${cell.date.getFullYear()}-${cell.date.getMonth()}-${cell.date.getDate()}`;
                const isToday = key === todayKey;
                const onVacation = vacationDates.has(key);
                const day = cell.date.getDay();

                return (
                  <div
                    key={idx}
                    className={`relative flex aspect-square flex-col items-center justify-start rounded-md p-1 transition-colors ${
                      !cell.inMonth
                        ? 'text-muted-foreground/40'
                        : onVacation
                          ? 'bg-warning/10 text-warning-foreground'
                          : 'text-foreground'
                    } ${isToday ? 'ring-primary ring-2' : 'hover:bg-muted/40'}`}
                  >
                    <span
                      className={`text-sm font-medium tabular-nums ${
                        day === 0 && cell.inMonth ? 'text-destructive' : ''
                      } ${day === 6 && cell.inMonth ? 'text-primary' : ''}`}
                    >
                      {cell.date.getDate()}
                    </span>
                    {cell.inMonth && cell.count > 0 ? (
                      <span className="bg-primary/10 text-primary mt-1 rounded px-1 text-[10px] font-bold tabular-nums leading-tight">
                        {cell.count}건
                      </span>
                    ) : null}
                    {onVacation ? (
                      <Plane className="text-warning absolute right-1 top-1 size-3" aria-hidden />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="size-4" aria-hidden />
              범례
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground space-y-1 text-xs">
            <p>
              <span className="bg-primary/10 text-primary inline-block rounded px-1.5 py-0.5 font-bold">
                3건
              </span>{' '}
              일자별 배차 건수
            </p>
            <p>
              <Plane className="text-warning inline size-3" /> 휴가 등록일
            </p>
            <p>
              <span className="ring-primary inline-block size-3 rounded-full ring-2" /> 오늘
            </p>
          </CardContent>
        </Card>
      </div>
    </DriverShell>
  );
}
