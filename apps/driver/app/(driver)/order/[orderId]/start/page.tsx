import { getServerClient } from '@mount/db';
import { ForbiddenError, RedirectError, requireRole } from '@mount/lib';
import { Card, CardContent, CardHeader, CardTitle } from '@mount/ui';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import { StartForm } from './start-form';

export const metadata = { title: '시공 시작' };

export default async function StartPage(props: {
  params: Promise<{ orderId: string }>;
}): Promise<ReactElement> {
  const { orderId } = await props.params;

  try {
    await requireRole(['technician']);
  } catch (error) {
    if (error instanceof RedirectError) {
      redirect(`/login?redirect=${encodeURIComponent(`/order/${orderId}/start`)}`);
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

  return (
    <main className="bg-background safe-top safe-bottom min-h-dvh px-4 py-6">
      <div className="mx-auto max-w-screen-md space-y-6">
        <header>
          <Link href={`/order/${orderId}`} className="text-muted-foreground text-sm">
            ← 주문 상세로
          </Link>
          <h1 className="mt-2 text-2xl font-bold">시공 시작</h1>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">시작 전 확인</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-7">
            <ol className="list-decimal space-y-1 pl-5">
              <li>고객 동의 확인 (신분증·결제 안내)</li>
              <li>
                <strong>필수 사진 2장</strong> 촬영 — TV 화면 + 벽 (사진 메뉴에서 업로드)
              </li>
              <li>주변 가구·커튼 등 간섭 정리</li>
              <li>준비 완료 후 아래 시작 버튼</li>
            </ol>
          </CardContent>
        </Card>

        <StartForm orderId={order.id} status={order.status} />
      </div>
    </main>
  );
}
