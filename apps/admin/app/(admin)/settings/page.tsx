import { getServerClient } from '@mount/db';
import { ForbiddenError, getSession, RedirectError, requireRole } from '@mount/lib';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@mount/ui';
import { Cog, Database, Lock, Sheet as SheetIcon, Shield, Users } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import { AdminShell } from '../_layout/admin-shell';
import { ChangePasswordForm } from './change-password';

export const metadata = { title: '설정' };

const ROLE_LABEL: Record<string, string> = {
  super_admin: '대표',
  cs_admin: '본사CS',
  dispatch_admin: '배차담당',
  ops_admin: '쿠팡CS',
  auditor: '감사',
};

const ROLE_DESCRIPTION: Record<string, string> = {
  super_admin: '모든 화면 + 모든 작업 권한',
  cs_admin: '주문 / 기사 / 정산 조회 + 본사CS 운영',
  dispatch_admin: '배차 / 기사 관리',
  ops_admin: '쿠팡 ETL + 결제 운영',
  auditor: '읽기 전용 — 감사 로그 + 모든 데이터 read',
};

export default async function SettingsPage(): Promise<ReactElement> {
  try {
    await requireRole(['admin']);
  } catch (error) {
    if (error instanceof RedirectError) redirect('/login?redirect=/settings');
    if (error instanceof ForbiddenError) redirect('/login?error=forbidden');
    throw error;
  }

  const session = await getSession();
  const isSuperAdmin = session?.adminRole === 'super_admin';

  // 시스템 통계 (super_admin 만)
  let stats: {
    technicians: number;
    activeTechnicians: number;
    admins: number;
  } | null = null;

  if (isSuperAdmin) {
    const client = await getServerClient();
    const [techActive, techAll, adminAll] = await Promise.all([
      client.from('technicians').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      client.from('technicians').select('id', { count: 'exact', head: true }),
      client.from('admin_users').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    ]);
    stats = {
      technicians: techAll.count ?? 0,
      activeTechnicians: techActive.count ?? 0,
      admins: adminAll.count ?? 0,
    };
  }

  const roleLabel = ROLE_LABEL[session?.adminRole ?? ''] ?? '관리자';
  const roleDescription = ROLE_DESCRIPTION[session?.adminRole ?? ''] ?? '';
  // 구글시트 연동 화면 접근 권한(= /settings/sheets 게이트와 동일)
  const canSheets = ['super_admin', 'dispatch_admin'].includes(session?.adminRole ?? '');

  return (
    <AdminShell title="설정">
      <div className="mx-auto max-w-screen-lg space-y-6 px-6 py-6">
        <header>
          <h2 className="text-2xl font-bold tracking-tight">설정</h2>
          <p className="text-muted-foreground text-sm">
            계정 정보, 시스템 환경, 보안 설정을 관리합니다.
          </p>
        </header>

        {/* 내 계정 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Cog className="size-4" aria-hidden />
              내 계정
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm md:grid-cols-2">
            <div>
              <p className="text-muted-foreground text-xs">역할</p>
              <div className="mt-0.5 flex items-center gap-2 font-semibold">
                <Badge>{roleLabel}</Badge>
              </div>
              <p className="text-muted-foreground mt-1 text-xs">{roleDescription}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">사용자 ID</p>
              <p className="mt-0.5 font-mono text-xs">
                {session?.userId.slice(0, 12) ?? '-'}…
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 비밀번호 변경 안내 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="size-4" aria-hidden />
              비밀번호 변경
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ChangePasswordForm />
            <p className="text-muted-foreground text-xs leading-6">
              비밀번호를 <strong className="text-foreground">잊어버린</strong> 경우에는 로그인을 할 수
              없으므로 여기서 바꿀 수 없습니다. 이때는{' '}
              <strong className="text-foreground">대표(super_admin)</strong> 에게 재발급을 요청해 주세요.
            </p>
          </CardContent>
        </Card>

        {/* 시스템 정보 — super_admin 만 */}
        {isSuperAdmin && stats ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="size-4" aria-hidden />
                시스템 현황
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-muted-foreground text-xs">전체 협력기사</p>
                <p className="text-foreground mt-0.5 text-2xl font-bold tabular-nums tracking-tight">
                  {stats.technicians}
                  <span className="text-muted-foreground ml-1 text-sm font-normal">명</span>
                </p>
                <p className="text-muted-foreground text-xs">
                  활성 {stats.activeTechnicians}명
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">관리자</p>
                <p className="text-foreground mt-0.5 text-2xl font-bold tabular-nums tracking-tight">
                  {stats.admins}
                  <span className="text-muted-foreground ml-1 text-sm font-normal">명</span>
                </p>
                <p className="text-muted-foreground text-xs">활성 계정</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">앱 버전</p>
                <p className="text-foreground mt-0.5 text-2xl font-bold tabular-nums tracking-tight">
                  v0.1.0
                </p>
                <p className="text-muted-foreground text-xs">2026-04 출시</p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* super_admin 작업 빠른 진입 */}
        {isSuperAdmin ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="size-4" aria-hidden />
                관리 빠른 진입
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <Link
                className="hover:bg-muted/40 hover:border-primary/50 flex items-center justify-between rounded-md border p-3 transition-colors"
                href="/technicians"
              >
                <div>
                  <p className="font-medium">협력기사 관리</p>
                  <p className="text-muted-foreground text-xs">
                    잠금 해제 · 등급 / 상태 변경
                  </p>
                </div>
                <span className="text-muted-foreground text-sm">→</span>
              </Link>
              <Link
                className="hover:bg-muted/40 hover:border-primary/50 flex items-center justify-between rounded-md border p-3 transition-colors"
                href="/technicians/new"
              >
                <div>
                  <p className="font-medium">신규 기사 발급</p>
                  <p className="text-muted-foreground text-xs">로그인 계정 자동 생성</p>
                </div>
                <span className="text-muted-foreground text-sm">→</span>
              </Link>
            </CardContent>
          </Card>
        ) : null}

        {/* 연동 */}
        {canSheets ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <SheetIcon className="size-4" aria-hidden />
                연동
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Link
                className="hover:bg-muted/40 hover:border-primary/50 flex items-center justify-between rounded-md border p-3 transition-colors"
                href="/settings/sheets"
              >
                <div>
                  <p className="font-medium">구글시트 연동</p>
                  <p className="text-muted-foreground text-xs">
                    본사 시공 ↔ 구글시트 양방향 동기화 · 서비스계정 · 열 매핑
                  </p>
                </div>
                <span className="text-muted-foreground text-sm">→</span>
              </Link>
            </CardContent>
          </Card>
        ) : null}

        {/* 보안 안내 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="size-4" aria-hidden />
              보안 안내
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground space-y-2 text-sm leading-7">
            <p>• 모든 PII(고객 이름·전화·주소)는 암호화되어 저장됩니다.</p>
            <p>• 모든 작업은 감사 로그(audit_events)에 자동 기록됩니다.</p>
            <p>• 본인 계정의 권한 외 데이터는 RLS 정책으로 차단됩니다.</p>
            <p>• 의심스러운 활동은 즉시 대표에게 보고해 주세요.</p>
          </CardContent>
        </Card>

        <p className="text-muted-foreground pt-2 text-center text-xs">
          마운트파트너스 관리자 v0.1.0 · © 2026 벽걸이프로
        </p>
      </div>
    </AdminShell>
  );
}
