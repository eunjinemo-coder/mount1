import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import type { ReactElement } from 'react';
import { OrderForm } from '@/components/order/order-form';
import { getOrderCatalog } from '@/lib/order-catalog';
import { getDummyProductBySlug } from '@/lib/dummy-products';

interface PageProps {
  params: Promise<{ slug: string }>;
}

// 주문서는 DB(variant_id) 의존 → 정적 생성하지 않는다(동적 렌더).
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = getDummyProductBySlug(slug);
  return {
    title: product ? `${product.name} 주문` : '주문',
    robots: { index: false, follow: false }, // 주문서는 색인 제외
  };
}

export default async function OrderPage({ params }: PageProps): Promise<ReactElement> {
  const { slug } = await params;
  const catalog = await getOrderCatalog(slug);
  if (!catalog) notFound();

  return (
    <main className="bg-background min-h-dvh">
      <div className="mx-auto max-w-lg px-5 pb-20">
        <div className="pt-4">
          <Link
            href={`/p/${slug}`}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
          >
            <ChevronLeft className="size-4" aria-hidden />
            상품 상세로
          </Link>
        </div>

        <header className="pt-6">
          <h1 className="text-2xl font-bold tracking-ko-tight">주문서</h1>
          <p className="text-muted-foreground mt-2 text-[15px] leading-7">
            {catalog.name} · {catalog.sizeRange}
          </p>
        </header>

        <div className="mt-8">
          <OrderForm catalog={catalog} />
        </div>

        <p className="text-muted-foreground mt-8 text-center text-xs leading-6">
          이미 주문하셨나요?{' '}
          <Link href="/order/lookup" className="text-foreground underline underline-offset-2">
            주문 조회
          </Link>
        </p>
      </div>
    </main>
  );
}
