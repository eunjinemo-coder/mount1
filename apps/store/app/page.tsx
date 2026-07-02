import type { ReactElement } from 'react';
import { HomeHero } from '@/components/home/home-hero';
import { ProductCard } from '@/components/home/product-card';
import { QuoteBanner } from '@/components/home/quote-banner';
import { TrustStrip } from '@/components/home/trust-strip';
import { DUMMY_PRODUCTS } from '@/lib/dummy-products';

export default function StoreHomePage(): ReactElement {
  return (
    <main className="bg-background min-h-dvh">
      <div className="mx-auto max-w-lg pb-16">
        <HomeHero />

        <div className="space-y-4 px-5">
          {DUMMY_PRODUCTS.map((product) => (
            <ProductCard key={product.slug} product={product} />
          ))}
        </div>

        <div className="mt-10 space-y-8">
          <TrustStrip />
          <QuoteBanner />
        </div>
      </div>
    </main>
  );
}
