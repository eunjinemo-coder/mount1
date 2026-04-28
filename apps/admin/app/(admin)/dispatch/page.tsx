import { getServerClient } from '@mount/db';
import { ForbiddenError, RedirectError, requireRole } from '@mount/lib';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import { AdminShell } from '../_layout/admin-shell';
import { AssignForm } from './assign-form';

export const metadata = { title: '배차 관리' };

export default async function DispatchPage(): Promise<ReactElement> {
  try {
    await requireRole({ adminRoles: ['super_admin', 'dispatch_admin'] });
  } catch (error) {
    if (error instanceof RedirectError) {
      redirect(`/login?redirect=${encodeURIComponent('/dispatch')}`);
    }
    if (error instanceof ForbiddenError) redirect('/login?error=forbidden');
    throw error;
  }

  const client = await getServerClient();

  const [ordersResult, techniciansResult] = await Promise.all([
    client
      .from('v_orders_dashboard')
      .select('id, tv_display, address_region_sigungu, scheduled_installation_at')
      .is('technician_name', null)
      .limit(50),
    client
      .from('technicians')
      .select('id, display_name, grade')
      .eq('status', 'active')
      .order('display_name', { ascending: true }),
  ]);

  const orders = (ordersResult.data ?? []).map((order) => ({
    id: order.id ?? '',
    tv: order.tv_display ?? 'TV 정보 없음',
    region: order.address_region_sigungu ?? '지역 미상',
    scheduled_at: order.scheduled_installation_at ?? null,
  }));

  const technicians = (techniciansResult.data ?? []).map((tech) => ({
    id: tech.id,
    display_name: tech.display_name,
    grade: tech.grade ?? 'bronze',
  }));

  return (
    <AdminShell activeNav="dispatch" notificationCount={orders.length} title="배차 관리">
      <div className="mx-auto max-w-screen-2xl space-y-6 px-6 py-6">
        <header className="flex items-baseline justify-between">
          <div>
            <h2 className="text-2xl font-bold">배차 관리</h2>
            <p className="text-muted-foreground text-sm">
              아직 기사가 정해지지 않은 주문 {orders.length}건 · 시공 가능 기사 {technicians.length}명
            </p>
          </div>
        </header>

        <AssignForm orders={orders} technicians={technicians} />
      </div>
    </AdminShell>
  );
}
