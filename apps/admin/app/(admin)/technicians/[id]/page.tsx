import { getServerClient } from '@mount/db';
import { ForbiddenError, RedirectError, requireRole } from '@mount/lib';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@mount/ui';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import { AdminShell } from '../../_layout/admin-shell';
import { TechnicianActionsCard, type TechnicianDetail } from './technician-actions-card';

export const metadata = { title: '기사 상세' };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function TechnicianDetailPage(props: {
  params: Promise<{ id: string }>;
}): Promise<ReactElement> {
  try {
    await requireRole({ adminRoles: ['super_admin'] });
  } catch (error) {
    if (error instanceof RedirectError) redirect('/login?redirect=/technicians');
    if (error instanceof ForbiddenError) redirect('/login?error=forbidden');
    throw error;
  }

  const { id } = await props.params;
  if (!UUID_RE.test(id)) notFound();

  const client = await getServerClient();
  const { data: rawData } = await client
    .from('technicians')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!rawData) notFound();

  // types.generated 가 stale 일 때를 대비 — runtime 검증으로 안전.
  const data = rawData as unknown as {
    id: string;
    display_name: string;
    login_id: string;
    phone: string;
    grade: string | null;
    status: string | null;
    daily_max_jobs: number | null;
    weekend_enabled: boolean | null;
    failed_login_count: number | null;
    locked_until: string | null;
    vehicle_number: string | null;
    home_base_region: string | null;
    preferred_regions: string[] | null;
    created_at: string | null;
  };

  // 최근 7일 시공 통계
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const { data: stats } = await client
    .from('orders')
    .select('id, status, conversion_from_no_drill', { count: 'exact' })
    .eq('assigned_technician_id', id)
    .gte('assigned_at', since.toISOString());

  const totalAssigned = stats?.length ?? 0;
  const completedCount =
    stats?.filter((o) =>
      ['no_drill_completed', 'drill_converted_completed', 'paid', 'closed'].includes(
        o.status ?? '',
      ),
    ).length ?? 0;
  const conversionCount = stats?.filter((o) => o.conversion_from_no_drill).length ?? 0;

  const tech: TechnicianDetail = {
    id: data.id,
    display_name: data.display_name,
    login_id: data.login_id,
    phone: data.phone,
    grade: data.grade ?? 'bronze',
    status: data.status ?? 'active',
    daily_max_jobs: data.daily_max_jobs ?? 6,
    weekend_enabled: data.weekend_enabled ?? false,
    failed_login_count: data.failed_login_count ?? 0,
    locked_until: data.locked_until,
    vehicle_number: data.vehicle_number,
    home_base_region: data.home_base_region,
    preferred_regions: data.preferred_regions ?? [],
    created_at: data.created_at ?? new Date().toISOString(),
  };

  const phoneMasked = tech.phone ? `***-****-${tech.phone.slice(-4)}` : '-';

  return (
    <AdminShell activeNav="technicians" title={`기사 - ${tech.display_name}`}>
      <div className="mx-auto max-w-screen-xl space-y-6 px-6 py-6">
        <header className="flex items-baseline justify-between">
          <div>
            <Link className="text-muted-foreground text-sm hover:underline" href="/technicians">
              ← 기사 목록
            </Link>
            <h2 className="text-2xl font-bold">{tech.display_name}</h2>
            <p className="text-muted-foreground text-sm">
              {tech.login_id} · {phoneMasked}
            </p>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline">{tech.grade}</Badge>
            <Badge variant={tech.status === 'active' ? 'default' : 'secondary'}>
              {tech.status}
            </Badge>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">기본 정보</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm md:grid-cols-2">
                <Field label="이름" value={tech.display_name} />
                <Field label="로그인 ID" value={tech.login_id} />
                <Field label="전화 (마스킹)" value={phoneMasked} />
                <Field label="차량번호" value={tech.vehicle_number ?? '-'} />
                <Field label="본거지" value={tech.home_base_region ?? '-'} />
                <Field label="등록일" value={new Date(tech.created_at).toLocaleDateString('ko-KR')} />
                <Field
                  label="선호 지역"
                  value={
                    tech.preferred_regions.length > 0
                      ? tech.preferred_regions.join(', ')
                      : '-'
                  }
                  span2
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">최근 7일 활동</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-4 text-center">
                <Stat label="배차" value={totalAssigned} />
                <Stat label="완료" value={completedCount} />
                <Stat label="전환" value={conversionCount} />
              </CardContent>
            </Card>
          </div>

          <div>
            <TechnicianActionsCard tech={tech} />
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

function Field({ label, value, span2 }: { label: string; value: string; span2?: boolean }): ReactElement {
  return (
    <div className={span2 ? 'md:col-span-2' : ''}>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }): ReactElement {
  return (
    <div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-muted-foreground text-xs">{label}</p>
    </div>
  );
}
