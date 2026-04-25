import { getServerClient } from '@mount/db';
import { ForbiddenError, RedirectError, requireRole } from '@mount/lib';
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

  // 사진 업로드는 on_site / in_progress 에서만 (RLS 정책 photos_insert_technician 과 일치)
  const ALLOWED = ['on_site', 'in_progress'] as const;
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
      const { data: signed } = await client.storage
        .from('photos-hot')
        .createSignedUrl(p.supabase_path, 3600);
      signedUrl = signed?.signedUrl ?? null;
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
      </div>
    </main>
  );
}
