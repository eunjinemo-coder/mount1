import { getServerClient } from '@mount/db';
import { ForbiddenError, RedirectError, requireRole } from '@mount/lib';
import { Button, Card, CardContent } from '@mount/ui';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import { PhotoGrid } from './photo-grid';

export const metadata = { title: '사진 업로드' };

const PHASE_LABEL: Record<string, string> = {
  pre_tv_screen: 'TV 화면 (시공 전)',
  pre_wall: '벽 (시공 전)',
  post_front: '정면 (완료)',
  post_left: '좌측 (완료)',
  post_right: '우측 (완료)',
  extra: '추가 (옵션)',
};

const SLOTS_PRE = ['pre_tv_screen', 'pre_wall'] as const;
const SLOTS_POST = ['post_front', 'post_left', 'post_right'] as const;
const SLOT_EXTRA = ['extra'] as const;

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

  // 사진 업로드는 assigned/en_route/on_site/in_progress 에서 허용 (RLS v2 migration §1.3 확장)
  const ALLOWED = ['assigned', 'en_route', 'on_site', 'in_progress'] as const;
  if (!ALLOWED.includes(order.status as (typeof ALLOWED)[number])) {
    redirect(`/order/${orderId}`);
  }

  // 기존 업로드 사진 조회 (자기 사진만) + signed URL 발급 (1시간 만료)
  const { data: existingPhotos } = await client
    .from('photos')
    .select('slot, supabase_path, uploaded_at')
    .eq('order_id', orderId)
    .eq('technician_id', session.technicianId ?? '');

  const photosBySlot = new Map<
    string,
    { path: string | null; uploadedAt: string | null; signedUrl: string | null }
  >();
  for (const p of existingPhotos ?? []) {
    let signedUrl: string | null = null;
    if (p.supabase_path) {
      // 한 사진의 signedUrl 생성 실패가 전체 페이지 렌더링을 깨뜨리지 않게 try-catch.
      // (예: storage 정책 변경 / path 일관성 이슈 / network 일시 fail)
      try {
        const { data: signed } = await client.storage
          .from('photos-hot')
          .createSignedUrl(p.supabase_path, 3600);
        signedUrl = signed?.signedUrl ?? null;
      } catch (err) {
        console.error('[photos] signedUrl 생성 실패:', { slot: p.slot, path: p.supabase_path, err });
        signedUrl = null;
      }
    }
    photosBySlot.set(p.slot, {
      path: p.supabase_path,
      uploadedAt: p.uploaded_at,
      signedUrl,
    });
  }

  const buildSlot = (slot: string) => ({
    slot,
    label: PHASE_LABEL[slot] ?? slot,
    uploaded: photosBySlot.has(slot),
    path: photosBySlot.get(slot)?.path ?? null,
    signedUrl: photosBySlot.get(slot)?.signedUrl ?? null,
  });

  // 필수 사진 업로드 진행률
  const preCount = SLOTS_PRE.filter((s) => photosBySlot.has(s)).length;
  const postCount = SLOTS_POST.filter((s) => photosBySlot.has(s)).length;
  const photoShortfall = preCount < 2 || postCount < 3;

  return (
    <main className="bg-background safe-top safe-bottom min-h-dvh px-4 py-6">
      <div className="mx-auto max-w-screen-md space-y-6">
        <header>
          <Link href={`/order/${orderId}`} className="text-muted-foreground text-sm">
            ← 주문 상세로
          </Link>
          <h1 className="mt-2 text-2xl font-bold">사진 업로드</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            시공 전 2장 (TV·벽) → 시공 → 시공 후 3장 (정면·좌·우) 순서로 촬영해 주세요.
          </p>
        </header>

        {/* 진행률 히어로 카드 */}
        <Card>
          <CardContent className="py-3 text-center">
            <p className="text-2xl font-bold tabular-nums">{preCount + postCount}/5</p>
            <p className="text-muted-foreground mt-1 text-xs">필수 사진 진행률</p>
          </CardContent>
        </Card>

        <PhotoGrid
          orderId={order.id}
          phase="시공 전 (필수 2장)"
          slots={SLOTS_PRE.map(buildSlot)}
        />

        <PhotoGrid
          orderId={order.id}
          phase="시공 후 (필수 3장)"
          slots={SLOTS_POST.map(buildSlot)}
        />

        <PhotoGrid
          orderId={order.id}
          phase="추가 (옵션)"
          slots={SLOT_EXTRA.map(buildSlot)}
        />

        {/* 업로드 완료 CTA */}
        <div className="space-y-2 pb-4">
          {photoShortfall ? (
            <p className="text-amber-700 text-sm">
              필수 사진이 부족합니다. 다음 화면에서 사유 입력 후 진행할 수 있습니다.
            </p>
          ) : null}
          <Button asChild className="w-full" size="lg">
            <Link href={`/order/${orderId}/complete`}>업로드 완료 → 시공 완료</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
