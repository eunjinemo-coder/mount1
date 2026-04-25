import { getServerClient } from '@mount/db';
import { ForbiddenError, RedirectError, requireRole } from '@mount/lib';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Separator } from '@mount/ui';
import { ChevronLeft, MapPin, Phone, Tv } from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { ReactElement } from 'react';

export const metadata = { title: '주문 상세' };

const DATETIME_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Seoul',
});

const STATUS_LABEL: Record<string, string> = {
  assigned: '배차 확정',
  en_route: '이동 중',
  on_site: '현장 도착',
  in_progress: '시공 중',
  no_drill_completed: '무타공 완료',
  drill_converted_completed: '타공 전환 완료',
};

const OPTION_LABEL: Record<string, string> = {
  A_stand: '스탠드',
  B_drill: '벽걸이 (타공)',
  C_no_drill: '벽걸이 (무타공)',
};

const KRW_FORMATTER = new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' });

export default async function OrderDetailPage(props: {
  params: Promise<{ orderId: string }>;
}): Promise<ReactElement> {
  const { orderId } = await props.params;

  try {
    await requireRole(['technician']);
  } catch (error) {
    if (error instanceof RedirectError) {
      redirect(`/login?redirect=${encodeURIComponent(`/order/${orderId}`)}`);
    }
    if (error instanceof ForbiddenError) redirect('/login?error=forbidden');
    throw error;
  }

  const client = await getServerClient();

  const [orderResult, customerResult] = await Promise.all([
    client.from('orders').select('*').eq('id', orderId).maybeSingle(),
    client.from('v_customer_for_technician').select('*').eq('id', orderId).maybeSingle(),
  ]);

  const order = orderResult.data;
  if (!order) notFound();

  const customer = customerResult.data;
  const region = [customer?.address_region_sido, customer?.address_region_sigungu]
    .filter(Boolean)
    .join(' ');
  const phoneTail4 = customer?.phone_tail4 ?? '';
  const scheduled = order.scheduled_installation_at
    ? DATETIME_FORMATTER.format(new Date(order.scheduled_installation_at))
    : '시간 미정';
  const tvDisplay = `${order.tv_brand ?? ''} ${order.tv_model ?? ''} ${order.tv_size_inch ? `(${order.tv_size_inch}")` : ''}`.trim();
  const optionLabel = OPTION_LABEL[order.option_selected] ?? order.option_selected;
  const priceB = order.price_option_b ? Number(order.price_option_b) : 0;
  const priceC = order.price_option_c ? Number(order.price_option_c) : 0;
  const conversionDiff = priceB - priceC;

  return (
    <main className="bg-background safe-top safe-bottom min-h-dvh px-4 py-4">
      <div className="mx-auto max-w-screen-md space-y-4">
        <header className="flex items-center justify-between">
          <Button asChild size="sm" variant="ghost">
            <Link href="/today">
              <ChevronLeft className="size-4" />
              오늘 시공
            </Link>
          </Button>
          <Badge variant="secondary">{STATUS_LABEL[order.status] ?? order.status}</Badge>
        </header>

        <h1 className="text-2xl font-bold">주문 상세</h1>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">예약 시각</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{scheduled}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="size-4" />
              고객
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-base">{region || '주소 정보 없음'}</p>
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <Phone className="size-4" />
              ***-****-{phoneTail4 || '????'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Tv className="size-4" />
              TV
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base">{tvDisplay || 'TV 정보 없음'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">옵션 · 가격</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">선택 옵션</span>
              <span className="font-medium">{optionLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">B 타공</span>
              <span className="tabular-nums">{KRW_FORMATTER.format(priceB)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">C 무타공</span>
              <span className="tabular-nums">{KRW_FORMATTER.format(priceC)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>전환 시 차액</span>
              <span className="tabular-nums">{KRW_FORMATTER.format(conversionDiff)}</span>
            </div>
          </CardContent>
        </Card>

        <ActionButtons orderId={order.id} status={order.status} />
      </div>
    </main>
  );
}

function ActionButtons({ orderId, status }: { orderId: string; status: string }): ReactElement {
  if (status === 'assigned') {
    return (
      <Button asChild className="w-full" size="lg">
        <Link href={`/order/${orderId}/start`}>출발</Link>
      </Button>
    );
  }
  if (status === 'en_route') {
    return (
      <Button asChild className="w-full" size="lg">
        <Link href={`/order/${orderId}/start`}>현장 도착</Link>
      </Button>
    );
  }
  if (status === 'on_site') {
    return (
      <div className="grid gap-3">
        <Button asChild className="w-full" size="lg">
          <Link href={`/order/${orderId}/start`}>시공 시작</Link>
        </Button>
        <Button asChild className="w-full" size="lg" variant="outline">
          <Link href={`/order/${orderId}/cancel`}>취소 리포트</Link>
        </Button>
      </div>
    );
  }
  if (status === 'in_progress') {
    return (
      <Button asChild className="w-full" size="lg">
        <Link href={`/order/${orderId}/complete`}>시공 완료</Link>
      </Button>
    );
  }
  return (
    <p className="text-muted-foreground py-4 text-center text-sm">
      현재 상태에서는 진행할 액션이 없어요.
    </p>
  );
}
