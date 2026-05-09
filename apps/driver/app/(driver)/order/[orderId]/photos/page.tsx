import { getServerClient } from '@mount/db';
import { ForbiddenError, RedirectError, requireRole } from '@mount/lib';
import { Button, Card, CardContent } from '@mount/ui';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import { PhotoUploader, type PhotoItem } from './photo-uploader';

export const metadata = { title: '시공 사진' };

const MIN_PHOTOS = 5;

export default async function PhotosPage(props: {
  params: Promise<{ orderId: string }>;
}): Promise<ReactElement> {
  const { orderId } = await props.params;

  let session;
  try {
    session = await requireRole(['technician']);
  } catch (error) {
    if (error instanceof RedirectError) {
      redirect(`/login?redirect=${encodeURIComponent(`/order/${orderId}/photos`)}`);
    }
    if (error instanceof ForbiddenError) redirect('/login?error=forbidden');
    throw error;
  }

  const client = await getServerClient();
  const { data: order } = await client
    .from('orders')
    .select('id, status')
    .eq('id', orderId)
    .maybeSingle();

  if (!order) notFound();

  const ALLOWED = ['assigned', 'en_route', 'on_site', 'in_progress'] as const;
  if (!ALLOWED.includes(order.status as (typeof ALLOWED)[number])) {
    redirect(`/order/${orderId}`);
  }

  // 본인 사진 전체 조회 (slot 무관) — 최신순으로 표시
  const { data: existingPhotos } = await client
    .from('photos')
    .select('id, slot, supabase_path, uploaded_at')
    .eq('order_id', orderId)
    .eq('technician_id', session.technicianId ?? '')
    .order('uploaded_at', { ascending: false });

  const photos: PhotoItem[] = await Promise.all(
    (existingPhotos ?? []).map(async (p) => {
      let signedUrl: string | null = null;
      if (p.supabase_path) {
        try {
          const { data: signed } = await client.storage
            .from('photos-hot')
            .createSignedUrl(p.supabase_path, 3600);
          signedUrl = signed?.signedUrl ?? null;
        } catch (err) {
          console.error('[photos] signedUrl 실패:', { id: p.id, err });
        }
      }
      return { id: p.id, slot: p.slot, signedUrl };
    }),
  );

  const enough = photos.length >= MIN_PHOTOS;

  return (
    <main className="bg-background safe-top safe-bottom min-h-dvh px-4 py-6">
      <div className="mx-auto max-w-screen-md space-y-6">
        <header>
          <Link href={`/order/${orderId}`} className="text-muted-foreground text-sm">
            ← 주문 상세로
          </Link>
          <h1 className="mt-2 text-2xl font-bold">시공 사진</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            시공 전·완료 사진 합쳐서 최소 {MIN_PHOTOS}장 등록해 주세요. 슬롯 구분 없이 한 번에 여러 장 선택할 수 있어요.
          </p>
        </header>

        {/* 진행률 hero */}
        <Card>
          <CardContent className="py-3 text-center">
            <p className="text-2xl font-bold tabular-nums">
              {photos.length}/{MIN_PHOTOS}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {enough ? '시공 사진 등록 완료' : '시공 사진 진행률'}
            </p>
          </CardContent>
        </Card>

        <PhotoUploader orderId={order.id} photos={photos} />

        {/* 업로드 완료 CTA */}
        <div className="space-y-2 pb-4">
          {!enough ? (
            <p className="text-amber-700 text-sm">
              최소 {MIN_PHOTOS}장 필요. 다음 화면에서 사유 입력 후 진행할 수도 있어요.
            </p>
          ) : null}
          <Button asChild className="w-full" size="lg" disabled={photos.length === 0}>
            <Link href={`/order/${orderId}/complete`}>업로드 완료 → 시공 완료</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
