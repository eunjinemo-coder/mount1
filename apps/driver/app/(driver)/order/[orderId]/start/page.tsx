import { getServerClient } from '@mount/db';
import { ForbiddenError, RedirectError, requireRole } from '@mount/lib';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@mount/ui';
import { Camera, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import { StartForm } from './start-form';

export const metadata = { title: '시공 시작' };

const REQUIRED_SLOTS = ['pre_tv_screen', 'pre_wall'] as const;
const SLOT_LABEL: Record<string, string> = {
  pre_tv_screen: 'TV 화면',
  pre_wall: '벽',
};

export default async function StartPage(props: {
  params: Promise<{ orderId: string }>;
}): Promise<ReactElement> {
  const { orderId } = await props.params;

  let session;
  try {
    session = await requireRole(['technician']);
  } catch (error) {
    if (error instanceof RedirectError) {
      redirect(`/login?redirect=${encodeURIComponent(`/order/${orderId}/start`)}`);
    }
    if (error instanceof ForbiddenError) redirect('/login?error=forbidden');
    throw error;
  }

  const client = await getServerClient();

  const [orderRes, photosRes] = await Promise.all([
    client.from('orders').select('id, status').eq('id', orderId).maybeSingle(),
    client
      .from('photos')
      .select('id, slot')
      .eq('order_id', orderId)
      .eq('technician_id', session.technicianId ?? '')
      .in('slot', [...REQUIRED_SLOTS]),
  ]);

  if (!orderRes.data) notFound();

  const photos = photosRes.data ?? [];
  const photoSlotSet = new Set(photos.map((p) => p.slot));
  const missingSlots = REQUIRED_SLOTS.filter((s) => !photoSlotSet.has(s));
  const allReady = missingSlots.length === 0;

  return (
    <main className="bg-background safe-top safe-bottom min-h-dvh px-4 py-6">
      <div className="mx-auto max-w-screen-md space-y-5">
        <header>
          <Link href={`/order/${orderId}`} className="text-muted-foreground text-sm">
            ← 주문 상세로
          </Link>
          <h1 className="mt-2 text-2xl font-bold">시공 시작</h1>
        </header>

        {/* 사진 가드 — 와이어 A06 P0 */}
        <Card className={allReady ? 'border-success/40' : 'border-warning/40'}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Camera className="size-4" aria-hidden />
              필수 사진 ({photos.length}/{REQUIRED_SLOTS.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-2">
              {REQUIRED_SLOTS.map((slot) => {
                const has = photoSlotSet.has(slot);
                return (
                  <li
                    key={slot}
                    className="bg-card flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                  >
                    {has ? (
                      <CheckCircle2 className="text-success size-4 shrink-0" aria-hidden />
                    ) : (
                      <XCircle className="text-warning size-4 shrink-0" aria-hidden />
                    )}
                    <span className="font-medium">{SLOT_LABEL[slot]}</span>
                    <span className="text-muted-foreground ml-auto text-xs">
                      {has ? '업로드 완료' : '미촬영'}
                    </span>
                  </li>
                );
              })}
            </ul>
            {!allReady ? (
              <Button asChild className="w-full" size="lg" variant="outline">
                <Link href={`/order/${orderId}/photos`}>
                  <Camera className="size-4" aria-hidden />
                  사진 촬영하러 가기
                </Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">시작 전 확인</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-7">
            <ol className="list-decimal space-y-1 pl-5">
              <li>고객 동의 확인 (신분증·결제 안내)</li>
              <li>
                <strong>필수 사진 2장</strong> 촬영 — TV 화면 + 벽
              </li>
              <li>주변 가구·커튼 등 간섭 정리</li>
              <li>준비 완료 후 아래 시작 버튼</li>
            </ol>
          </CardContent>
        </Card>

        <StartForm
          allPhotosReady={allReady}
          missingCount={missingSlots.length}
          orderId={orderRes.data.id}
          status={orderRes.data.status}
        />
      </div>
    </main>
  );
}
