import { formatCurrencyKRW } from '@mount/lib';
import { Separator } from '@mount/ui';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactElement } from 'react';
import { ConstructionGallery } from '@/components/product/construction-gallery';
import { PainPoints } from '@/components/product/pain-points';
import { ProductFaq } from '@/components/product/product-faq';
import { ProductHero } from '@/components/product/product-hero';
import { QualityEvidence } from '@/components/product/quality-evidence';
import { SpecTable } from '@/components/product/spec-table';
import { StickyOrderCta } from '@/components/product/sticky-order-cta';
import { WholesalePricing } from '@/components/product/wholesale-pricing';
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

  const description = `${product.sizeRange} · ${formatCurrencyKRW(product.basePrice)}부터 — ${product.valueProp}`;

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
    <main className="bg-background min-h-dvh pb-32">
      <div className="mx-auto max-w-lg">
        <ProductHero product={product} />

        <div className="mt-8 space-y-10">
          <PainPoints items={product.painPoints} />
          <QualityEvidence items={product.qualityPoints} />
          <ConstructionGallery items={product.gallery} />
          <SpecTable rows={product.spec} />
          <WholesalePricing basePrice={product.basePrice} priceTiers={product.priceTiers} />
          <ProductFaq items={product.faq} />
        </div>

        <Separator className="mt-10" />
        <p className="text-muted-foreground px-5 py-6 text-center text-xs leading-6">
          벽걸이프로 공식 스토어 · 사업자 대상 전자세금계산서 발행
          <br />
          자재 하자 1년 무상 교체
        </p>
      </div>

      <StickyOrderCta basePrice={product.basePrice} />
    </main>
  );
}
