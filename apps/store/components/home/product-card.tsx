import { formatCurrencyKRW } from '@mount/lib';
import { Card, CardContent } from '@mount/ui';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactElement } from 'react';
import { calcUnitSavings, type DummyProduct } from '@/lib/dummy-products';

interface Props {
  product: DummyProduct;
}

/**
 * 홈 제품 카드 — 가격·인치 호환 노출 + 도매 절감 힌트.
 */
export function ProductCard({ product }: Props): ReactElement {
  const bestTier = [...product.priceTiers].sort((a, b) => b.minQty - a.minQty)[0];
  const bestUnitSavings = bestTier ? calcUnitSavings(product.basePrice, bestTier.unitPrice) : 0;

  return (
    <Link href={`/p/${product.slug}`} className="block">
      <Card className="overflow-hidden border-border/70 shadow-none transition-shadow hover:shadow-2">
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
          <p className="text-muted-foreground text-xs">{product.sizeRange} 호환</p>
          <h2 className="text-base font-semibold leading-snug">{product.name}</h2>
          <div className="flex items-baseline gap-2 pt-0.5">
            <p className="tabular text-lg font-bold">
              {formatCurrencyKRW(product.basePrice)}
              <span className="text-muted-foreground ml-1 text-xs font-normal">부터</span>
            </p>
            {bestUnitSavings > 0 && (
              <span className="bg-brand-50 text-brand-700 tabular rounded-full px-2 py-0.5 text-[11px] font-semibold">
                대량 시 개당 {formatCurrencyKRW(bestUnitSavings)}↓
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
