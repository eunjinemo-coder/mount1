import { Card, CardContent } from '@mount/ui';
import { formatCurrencyKRW } from '@mount/lib';
import { ShieldCheck } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactElement } from 'react';
import { DUMMY_PRODUCTS } from '@/lib/dummy-products';

export default function StoreHomePage(): ReactElement {
  return (
    <main className="bg-background min-h-dvh">
      {/* Hero */}
      <section className="mx-auto max-w-lg px-5 pt-14 pb-10 text-center">
        <p className="text-primary text-sm font-semibold">벽걸이프로</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          구멍 하나 없이,
          <br />
          완벽하게 걸리는 TV
        </h1>
        <p className="text-muted-foreground mt-3 text-sm leading-7">
          전국 협력기사 시공망 · 무타공 안전 시공 (준비 중 — 실 시공 데이터 연동 예정)
        </p>
        <div className="text-muted-foreground mt-6 flex items-center justify-center gap-1.5 text-xs">
          <ShieldCheck className="text-primary size-4" aria-hidden />
          <span>안심 A/S · 자재 하자 보증 (내용 준비 중)</span>
        </div>
      </section>

      {/* Product list */}
      <section className="mx-auto max-w-lg space-y-4 px-5 pb-16">
        {DUMMY_PRODUCTS.map((product) => (
          <Link key={product.slug} href={`/p/${product.slug}`} className="block">
            <Card className="overflow-hidden transition-shadow hover:shadow-md">
              <div className="bg-muted relative aspect-[4/3] w-full">
                <Image
                  src={product.imageSrc}
                  alt={product.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 512px) 100vw, 512px"
                />
              </div>
              <CardContent className="space-y-1.5 p-4">
                <p className="text-muted-foreground text-xs">{product.sizeRange}</p>
                <h2 className="text-base font-semibold leading-snug">{product.name}</h2>
                <p className="tabular text-lg font-bold">
                  {formatCurrencyKRW(product.basePrice)}
                  <span className="text-muted-foreground ml-1 text-xs font-normal">부터</span>
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>
    </main>
  );
}
