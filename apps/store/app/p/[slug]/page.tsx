import { formatCurrencyKRW } from '@mount/lib';
import { Card, CardContent } from '@mount/ui';
import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import type { ReactElement } from 'react';
import { DUMMY_PRODUCTS, getDummyProductBySlug } from '@/lib/dummy-products';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams(): { slug: string }[] {
  return DUMMY_PRODUCTS.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = getDummyProductBySlug(slug);
  if (!product) return {};

  const description = `${product.sizeRange} · ${formatCurrencyKRW(product.basePrice)}부터 — 무타공 안전 시공, 벽걸이프로 공식 스토어.`;

  return {
    title: product.name,
    description,
    openGraph: {
      title: product.name,
      description,
    },
  };
}

export default async function ProductDetailPage({ params }: PageProps): Promise<ReactElement> {
  const { slug } = await params;
  const product = getDummyProductBySlug(slug);
  if (!product) notFound();

  return (
    <main className="bg-background min-h-dvh pb-28">
      {/* Hero image */}
      <div className="bg-muted relative aspect-[4/3] w-full">
        <Image
          src={product.imageSrc}
          alt={product.name}
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
      </div>

      <div className="mx-auto max-w-lg space-y-8 px-5 py-6">
        {/* 상품 기본 정보 */}
        <section className="space-y-2">
          <p className="text-muted-foreground text-sm">{product.sizeRange}</p>
          <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
          <p className="tabular text-2xl font-bold">
            {formatCurrencyKRW(product.basePrice)}
            <span className="text-muted-foreground ml-1 text-sm font-normal">1개 기준</span>
          </p>
          <p className="text-muted-foreground text-xs">재고 {product.stock}개 (준비 중 — 실 재고 연동 예정)</p>
        </section>

        {/* 수량구간 단가표 */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">수량별 단가</h2>
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-border border-b">
                    <th className="text-muted-foreground px-4 py-3 text-left font-medium">수량</th>
                    <th className="text-muted-foreground px-4 py-3 text-right font-medium">개당 단가</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-border border-b">
                    <td className="px-4 py-3">1개 이상</td>
                    <td className="tabular px-4 py-3 text-right font-semibold">
                      {formatCurrencyKRW(product.basePrice)}
                    </td>
                  </tr>
                  {product.priceTiers.map((tier) => (
                    <tr key={tier.minQty} className="border-border border-b last:border-b-0">
                      <td className="px-4 py-3">{tier.minQty}개 이상</td>
                      <td className="tabular px-4 py-3 text-right font-semibold">
                        {formatCurrencyKRW(tier.unitPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </section>

        {/* 스펙 표 (placeholder) */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">제품 스펙</h2>
          <Card>
            <CardContent className="text-muted-foreground p-4 text-sm">
              스펙 정보는 준비 중입니다. (호환 사이즈 · 최대 하중 · 자재 · 구성품 등)
            </CardContent>
          </Card>
        </section>

        {/* FAQ (placeholder) */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">자주 묻는 질문</h2>
          <Card>
            <CardContent className="text-muted-foreground p-4 text-sm">
              FAQ 콘텐츠는 준비 중입니다.
            </CardContent>
          </Card>
        </section>
      </div>

      {/* Sticky CTA — 주문 페이지(R3) 준비 전까지 비활성화 */}
      <div className="border-border bg-background/95 safe-bottom fixed inset-x-0 bottom-0 border-t px-5 py-4 backdrop-blur">
        <div className="mx-auto max-w-lg">
          <button
            type="button"
            disabled
            className="bg-muted text-muted-foreground flex h-12 w-full items-center justify-center rounded-md text-sm font-semibold disabled:cursor-not-allowed"
          >
            주문하기 · 준비 중
          </button>
        </div>
      </div>
    </main>
  );
}
