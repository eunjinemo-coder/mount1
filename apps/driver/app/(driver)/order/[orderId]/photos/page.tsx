import { Card, CardContent, CardHeader, CardTitle } from '@mount/ui';
import { Camera } from 'lucide-react';
import Link from 'next/link';
import type { ReactElement } from 'react';

export const metadata = { title: '사진 업로드' };

/**
 * A07 사진 업로드 — R5 본격 구현 (Supabase Storage `photos-hot` 버킷 + EXIF 추출).
 * 현재는 stub 페이지로 dead-end 회피.
 */
export default async function PhotosPage(props: {
  params: Promise<{ orderId: string }>;
}): Promise<ReactElement> {
  const { orderId } = await props.params;

  return (
    <main className="bg-background safe-top safe-bottom min-h-dvh px-4 py-6">
      <div className="mx-auto max-w-screen-md space-y-6">
        <header>
          <Link href={`/order/${orderId}`} className="text-muted-foreground text-sm">
            ← 주문 상세로
          </Link>
          <h1 className="mt-2 text-2xl font-bold">사진 업로드</h1>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Camera className="size-4" />
              R5 작업 예정
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6">
            <p>
              6 슬롯 사진 업로드 (시공 전 2장 + 시공 완료 3장 + extra 1장) 와 Supabase Storage{' '}
              <code className="bg-muted rounded px-1">photos-hot</code> 버킷, EXIF 추출, 자동 압축
              (WebP) 은 다음 라운드(R5)에서 구현 예정입니다.
            </p>
            <p className="text-muted-foreground">
              임시: 사진 없이 시공 시작·완료 RPC 호출 시 <code>missing_pre_photos</code>{' '}
              ·<code>missing_post_photos</code> 에러로 차단됩니다. 실 시공 전 본 화면 완성 필수.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
