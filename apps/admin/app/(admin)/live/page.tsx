import { getServerClient } from '@mount/db';
import {
  ForbiddenError,
  LIVE_DASHBOARD_STATUSES,
  RedirectError,
  requireRole,
} from '@mount/lib';
import { Badge, Card, CardContent, CardHeader, CardTitle, KakaoMap, type KakaoMapMarker } from '@mount/ui';
import { MapPin } from 'lucide-react';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import { AdminShell } from '../_layout/admin-shell';

export const metadata = { title: '실시간 현황판' };

const STATUS_LABEL: Record<string, string> = {
  assigned: '배차',
  en_route: '이동중',
  on_site: '도착',
  in_progress: '시공중',
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  assigned: 'outline',
  en_route: 'secondary',
  on_site: 'default',
  in_progress: 'default',
};

const TIME = new Intl.DateTimeFormat('ko-KR', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Seoul',
});

export default async function LivePage(): Promise<ReactElement> {
  try {
    await requireRole(['admin']);
  } catch (error) {
    if (error instanceof RedirectError) redirect('/login?redirect=/live');
    if (error instanceof ForbiddenError) redirect('/login?error=forbidden');
    throw error;
  }

  const client = await getServerClient();

  // 오늘 진행 중 + 배차 완료 주문 (위치 좌표 있는 것만)
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const { data: rawOrders } = await client
    .from('orders')
    .select(
      'id, status, scheduled_installation_at, customers!inner(address_lat, address_lng, address_region_sigungu), technicians:assigned_technician_id(id, display_name, last_known_lat, last_known_lng)',
    )
    .in('status', LIVE_DASHBOARD_STATUSES)
    .gte('scheduled_installation_at', startOfDay.toISOString())
    .lte('scheduled_installation_at', endOfDay.toISOString())
    .order('scheduled_installation_at', { ascending: true })
    .limit(50);

  // Supabase 1:1 join 결과는 단일 객체로 반환되지만, 클라이언트 타입 추론이 배열로 잡힐 수 있어 정규화.
  interface CustomerRow {
    address_lat: number | null;
    address_lng: number | null;
    address_region_sigungu: string | null;
  }
  interface TechnicianRow {
    id: string;
    display_name: string;
    last_known_lat: number | null;
    last_known_lng: number | null;
  }
  interface RawOrderRow {
    id: string;
    status: string;
    scheduled_installation_at: string | null;
    customers: CustomerRow | CustomerRow[] | null;
    technicians: TechnicianRow | TechnicianRow[] | null;
  }
  const pickOne = <T,>(v: T | T[] | null | undefined): T | null => {
    if (Array.isArray(v)) return v[0] ?? null;
    return v ?? null;
  };
  // PII 완화 — 정밀 좌표를 소수점 2자리(~1km)로 반올림하여 마커 표시.
  // 자택/기사 정확 위치 노출 차단. 약도 식별은 충분.
  const blurCoord = (n: number): number => Math.round(n * 100) / 100;

  const orders = (rawOrders ?? []) as unknown as RawOrderRow[];
  const orderMarkers: KakaoMapMarker[] = [];
  const techMarkers: KakaoMapMarker[] = [];
  for (const o of orders) {
    const customer = pickOne(o.customers);
    const technician = pickOne(o.technicians);
    if (customer?.address_lat != null && customer?.address_lng != null) {
      orderMarkers.push({
        id: `order-${o.id}`,
        lat: blurCoord(customer.address_lat),
        lng: blurCoord(customer.address_lng),
        label: `${customer.address_region_sigungu ?? ''} · ${STATUS_LABEL[o.status] ?? o.status}`,
        variant: 'default',
      });
    }
    if (technician?.last_known_lat != null && technician?.last_known_lng != null) {
      techMarkers.push({
        id: `tech-${technician.id}`,
        lat: blurCoord(technician.last_known_lat),
        lng: blurCoord(technician.last_known_lng),
        label: technician.display_name,
        variant: 'highlight',
      });
    }
  }

  // 지도 중심 — 마커 평균 또는 서울 기본
  const allLats = [...orderMarkers, ...techMarkers].map((m) => m.lat);
  const allLngs = [...orderMarkers, ...techMarkers].map((m) => m.lng);
  const center =
    allLats.length > 0
      ? {
          lat: allLats.reduce((s, x) => s + x, 0) / allLats.length,
          lng: allLngs.reduce((s, x) => s + x, 0) / allLngs.length,
        }
      : { lat: 37.5665, lng: 126.978 }; // 서울시청 기본

  return (
    <AdminShell activeNav="live" title="실시간 현황판">
      <div className="mx-auto max-w-screen-2xl space-y-6 px-6 py-6">
        <header>
          <h2 className="text-2xl font-bold">실시간 시공 현황</h2>
          <p className="text-muted-foreground text-sm">
            진행 중 {orders.length}건 · 마커 {orderMarkers.length} (주문) +{' '}
            {techMarkers.length} (기사 위치)
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* 지도 (2/3) */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="size-4" aria-hidden />
                지도
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              <KakaoMap
                center={center}
                markers={[...orderMarkers, ...techMarkers]}
                height={520}
                level={6}
              />
            </CardContent>
          </Card>

          {/* 사이드 리스트 (1/3) */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">진행 중 주문</CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              {orders.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  현재 진행 중인 주문이 없어요.
                </p>
              ) : (
                <ul className="space-y-2">
                  {orders.map((o) => {
                    const time = o.scheduled_installation_at
                      ? TIME.format(new Date(o.scheduled_installation_at))
                      : '미정';
                    const customer = pickOne(o.customers);
                    const technician = pickOne(o.technicians);
                    return (
                      <li
                        key={o.id}
                        className="flex items-center justify-between gap-2 rounded-md border px-3 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-foreground tabular-nums text-sm font-bold">
                            {time}
                          </p>
                          <p className="text-muted-foreground truncate text-xs">
                            {customer?.address_region_sigungu ?? '-'} ·{' '}
                            {technician?.display_name ?? '미배정'}
                          </p>
                        </div>
                        <Badge variant={STATUS_VARIANT[o.status] ?? 'outline'}>
                          {STATUS_LABEL[o.status] ?? o.status}
                        </Badge>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminShell>
  );
}
