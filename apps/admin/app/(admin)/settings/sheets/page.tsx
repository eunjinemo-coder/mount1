import { getServerClient } from '@mount/db';
import { formatDateTimeKST } from '@mount/lib';
import { ForbiddenError, getSession, RedirectError, requireRole } from '@mount/lib';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@mount/ui';
import { Sheet as SheetIcon } from 'lucide-react';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import { AdminShell } from '../../_layout/admin-shell';
import { SheetsManager, type SheetLinkView } from './sheets-manager';

export const metadata = { title: '구글시트 연동' };

const SHEETS_ROLES = ['super_admin', 'dispatch_admin'];

interface LinkRow {
  id: string;
  spreadsheet_id: string;
  sheet_name: string;
  entity: string;
  column_map: Record<string, string> | null;
  active: boolean;
}
interface OutboxRow {
  link_id: string;
  status: string;
}
interface LogRow {
  link_id: string | null;
  direction: string;
  result: string;
  created_at: string;
}

const RESULT_LABEL: Record<string, string> = {
  ok: '반영',
  skipped_noop: '무시(에코/중복)',
  conflict_sheet_won: '충돌(시트 우선)',
  conflict_app_won: '충돌(앱 우선)',
  error: '오류',
};

const RESULT_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  ok: 'default',
  skipped_noop: 'secondary',
  conflict_sheet_won: 'outline',
  conflict_app_won: 'outline',
  error: 'destructive',
};

export default async function SheetsSettingsPage(): Promise<ReactElement> {
  try {
    await requireRole(['admin']);
  } catch (error) {
    if (error instanceof RedirectError) redirect('/login?redirect=/settings/sheets');
    if (error instanceof ForbiddenError) redirect('/login?error=forbidden');
    throw error;
  }

  const session = await getSession();
  if (!session || !SHEETS_ROLES.includes(session.adminRole ?? '')) {
    // 감사(auditor)·기타 역할은 읽기만 — 여기선 설정 화면 접근 차단(안내)
    return (
      <AdminShell title="구글시트 연동">
        <div className="mx-auto max-w-screen-md px-6 py-6">
          <Card>
            <CardContent className="text-muted-foreground py-6 text-sm">
              구글시트 연동 설정은 대표(super_admin) 또는 배차담당(dispatch_admin)만 관리할 수 있어요.
            </CardContent>
          </Card>
        </div>
      </AdminShell>
    );
  }

  const client = await getServerClient();
  const cast = client as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        in?: (c: string, v: string[]) => PromiseLike<{ data: unknown }>;
        order: (c: string, o: { ascending: boolean }) => {
          limit: (n: number) => PromiseLike<{ data: unknown }>;
        } & PromiseLike<{ data: unknown }>;
      } & PromiseLike<{ data: unknown }>;
    };
  };

  const [linksRes, outboxRes, logsRes] = await Promise.all([
    cast.from('sheet_links').select('id, spreadsheet_id, sheet_name, entity, column_map, active').order('created_at', { ascending: true }),
    (cast.from('sync_outbox').select('link_id, status') as unknown as { in: (c: string, v: string[]) => PromiseLike<{ data: unknown }> }).in('status', ['pending', 'failed']),
    cast.from('sync_log').select('link_id, direction, result, created_at').order('created_at', { ascending: false }).limit(10),
  ]);

  const linkRows = ((linksRes.data as LinkRow[] | null) ?? []);
  const outboxRows = ((outboxRes.data as OutboxRow[] | null) ?? []);
  const logRows = ((logsRes.data as LogRow[] | null) ?? []);

  const pendingByLink = new Map<string, number>();
  const failedByLink = new Map<string, number>();
  for (const r of outboxRows) {
    const target = r.status === 'failed' ? failedByLink : pendingByLink;
    target.set(r.link_id, (target.get(r.link_id) ?? 0) + 1);
  }

  const links: SheetLinkView[] = linkRows.map((l) => ({
    id: l.id,
    spreadsheetId: l.spreadsheet_id,
    sheetName: l.sheet_name,
    entity: l.entity,
    active: l.active,
    columnCount: l.column_map ? Object.keys(l.column_map).length : 0,
    pending: pendingByLink.get(l.id) ?? 0,
    failed: failedByLink.get(l.id) ?? 0,
  }));

  const totalPending = outboxRows.filter((r) => r.status === 'pending').length;
  const totalFailed = outboxRows.filter((r) => r.status === 'failed').length;
  const lastSuccess = logRows.find((l) => l.result === 'ok')?.created_at ?? null;

  return (
    <AdminShell title="구글시트 연동">
      <div className="mx-auto max-w-screen-lg space-y-6 px-6 py-6">
        <header>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <SheetIcon className="size-5" aria-hidden />
            구글시트 연동
          </h2>
          <p className="text-muted-foreground text-sm">
            시공 일정을 구글시트와 양방향으로 동기화합니다. 시트 양식은 바꾸지 않습니다.
          </p>
        </header>

        {/* 동기화 상태 위젯 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">동기화 상태</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-muted-foreground text-xs">마지막 성공</p>
              <p className="mt-0.5 text-sm font-semibold">
                {lastSuccess ? formatDateTimeKST(lastSuccess) : '기록 없음'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">대기</p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums">{totalPending}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">실패</p>
              <p
                className={`mt-0.5 text-2xl font-bold tabular-nums ${totalFailed > 0 ? 'text-destructive' : ''}`}
              >
                {totalFailed}
              </p>
            </div>
          </CardContent>
        </Card>

        <SheetsManager links={links} />

        {/* 최근 동기화 로그 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">최근 동기화 로그</CardTitle>
          </CardHeader>
          <CardContent>
            {logRows.length === 0 ? (
              <p className="text-muted-foreground text-sm">로그가 없습니다.</p>
            ) : (
              <ul className="divide-y text-sm">
                {logRows.map((l, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-2">
                    <span className="text-muted-foreground text-xs">
                      {formatDateTimeKST(l.created_at)}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {l.direction === 'app_to_sheet' ? '앱 → 시트' : '시트 → 앱'}
                    </span>
                    <Badge variant={RESULT_VARIANT[l.result] ?? 'secondary'}>
                      {RESULT_LABEL[l.result] ?? l.result}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* 설정 안내 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">활성화 절차 (은진님 1회)</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground space-y-2 text-sm leading-7">
            <p>① Google Cloud 서비스계정 생성 → 시트에 편집자로 공유</p>
            <p>② 시트 [확장 프로그램 › Apps Script] 에 제공 스크립트(docs/sheets-sync/AppsScript.gs) 붙여넣기 → installTrigger 실행</p>
            <p>③ 위에서 시트 URL·탭·열 매핑 지정(현재 시트 양식 그대로 매핑 — 양식 변경 없음)</p>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
