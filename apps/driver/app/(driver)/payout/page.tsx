import { getServerClient } from '@mount/db';
import { COMPLETED_ORDER_STATUSES, ForbiddenError, RedirectError, requireRole } from '@mount/lib';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@mount/ui';
import { TrendingUp, Wallet } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import { DriverShell } from '../_layout/driver-shell';

export const metadata = { title: '정산' };

const DATE = new Intl.DateTimeFormat('ko-KR', {
  month: 'short',
  day: 'numeric',
  weekday: 'short',
  timeZone: 'Asia/Seoul',
});

interface DayRow {
  /** ISO 안정 key (YYYY-MM-DD) — list key + 정렬용 */
  key: string;
  /** 한국어 포맷 표시 — Intl.DateTimeFormat 결과 */
  date: string;
  count: number;
  options: { A: number; B: number; C: number; conversion: number };
}

export default async function PayoutPage(props: {
  searchParams: Promise<{ ym?: string }>;
}): Promise<ReactElement> {
  let session;
  try {
    session = await requireRole(['technician']);
  } catch (error) {
    if (error instanceof RedirectError) redirect('/login?redirect=/payout');
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

  const { data: orders } = await client
    .from('orders')
    .select('id, status, option_selected, conversion_from_no_drill, status_changed_at')
    .eq('assigned_technician_id', session.technicianId ?? '')
    .in('status', COMPLETED_ORDER_STATUSES)
    .gte('status_changed_at', monthStart.toISOString())
    .lte('status_changed_at', monthEnd.toISOString())
    .order('status_changed_at', { ascending: false });

  // 일자별 그룹 — Map 객체를 새 객체로 교체 (헌법 immutability).
  const byDay = new Map<string, DayRow>();
  for (const o of orders ?? []) {
    if (!o.status_changed_at) continue;
    const d = new Date(o.status_changed_at);
    const isoKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`;
    const prev = byDay.get(isoKey) ?? {
      key: isoKey,
      date: DATE.format(d),
      count: 0,
      options: { A: 0, B: 0, C: 0, conversion: 0 },
    };
    const next: DayRow = {
      key: prev.key,
      date: prev.date,
      count: prev.count + 1,
      options: {
        A: prev.options.A + (o.option_selected === 'A_stand' ? 1 : 0),
        B: prev.options.B + (o.option_selected === 'B_drill' ? 1 : 0),
        C: prev.options.C + (o.option_selected === 'C_no_drill' ? 1 : 0),
        conversion: prev.options.conversion + (o.conversion_from_no_drill ? 1 : 0),
      },
    };
    byDay.set(isoKey, next);
  }
  const days = Array.from(byDay.values());

  const total = orders?.length ?? 0;
  const totalA = days.reduce((s, d) => s + d.options.A, 0);
  const totalB = days.reduce((s, d) => s + d.options.B, 0);
  const totalC = days.reduce((s, d) => s + d.options.C, 0);
  const totalConversion = days.reduce((s, d) => s + d.options.conversion, 0);

  const prevMonth = new Date(target.getFullYear(), target.getMonth() - 1, 1);
  const nextMonth = new Date(target.getFullYear(), target.getMonth() + 1, 1);
  const formatYM = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  return (
    <DriverShell>
      <div className="mx-auto max-w-screen-md space-y-4 px-4 py-6">
        <header className="flex items-baseline justify-between">
          <h1 className="text-2xl font-bold">정산</h1>
        </header>

        {/* 월 네비 */}
        <div className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm">
          <Button asChild size="sm" variant="ghost">
            <Link href={`/payout?ym=${formatYM(prevMonth)}`}>← 이전 달</Link>
          </Button>
          <span className="font-semibold tabular-nums">
            {target.getFullYear()}년 {target.getMonth() + 1}월
          </span>
          <Button asChild size="sm" variant="ghost">
            <Link href={`/payout?ym=${formatYM(nextMonth)}`}>다음 달 →</Link>
          </Button>
        </div>

        {/* 월 요약 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="size-4" aria-hidden />
              월 요약
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="완료 시공" value={total} />
            <Stat label="스탠드(A)" value={totalA} />
            <Stat label="타공(B)" value={totalB} />
            <Stat label="무타공(C)" value={totalC} />
          </CardContent>
        </Card>

        {totalConversion > 0 ? (
          <Card>
            <CardContent className="flex items-center justify-between gap-3 py-4">
              <div>
                <p className="text-sm font-medium">타공 전환 (C → B)</p>
                <p className="text-muted-foreground text-xs">
                  현장 합의로 타공 전환된 건수
                </p>
              </div>
              <Badge>{totalConversion}건</Badge>
            </CardContent>
          </Card>
        ) : null}

        {/* 일자별 내역 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="size-4" aria-hidden />
              일자별 내역 ({days.length}일)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            {days.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                완료된 시공이 없어요.
              </p>
            ) : (
              <ul className="space-y-2">
                {days.map((d) => (
                  <li
                    key={d.key}
                    className="flex items-center justify-between rounded-md border px-3 py-2.5"
                  >
                    <div>
                      <p className="font-medium text-sm">{d.date}</p>
                      <p className="text-muted-foreground text-xs">
                        {d.options.A > 0 ? `A ${d.options.A} ` : ''}
                        {d.options.B > 0 ? `B ${d.options.B} ` : ''}
                        {d.options.C > 0 ? `C ${d.options.C}` : ''}
                        {d.options.conversion > 0 ? ` · 전환 ${d.options.conversion}` : ''}
                      </p>
                    </div>
                    <Badge variant="outline">{d.count}건</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <p className="text-muted-foreground text-center text-xs leading-6">
          정산 금액은 본사 정산 룰 확정 후 자동 계산됩니다.
          <br />
          현재는 시공 건수만 집계되며, 월말 본사 카카오톡 채널로 정산 내역이 안내됩니다.
        </p>
      </div>
    </DriverShell>
  );
}

function Stat({ label, value }: { label: string; value: number }): ReactElement {
  return (
    <div className="text-center">
      <p className="text-foreground text-2xl font-bold tabular-nums leading-none">
        {value}
      </p>
      <p className="text-muted-foreground mt-1 text-xs">{label}</p>
    </div>
  );
}
