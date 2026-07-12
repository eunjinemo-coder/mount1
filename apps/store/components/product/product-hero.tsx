import Image from 'next/image';
import { ShieldCheck } from 'lucide-react';
import type { ReactElement } from 'react';
import type { DummyProduct } from '@/lib/dummy-products';

interface Props {
  product: DummyProduct;
}

/**
 * S2 히어로 — 제품명 + 한줄 가치제안 + 신뢰 배지 + 대표 이미지.
 * 페이지의 유일한 h1 을 담당.
 */
export function ProductHero({ product }: Props): ReactElement {
  return (
    <section className="px-5 pt-8 pb-2">
      <p className="text-primary text-sm font-semibold">벽걸이프로 · 무타공 시공 브라켓</p>
      <h1 className="mt-2 text-[26px] font-bold leading-tight tracking-ko-tight">{product.name}</h1>
      <p className="text-muted-foreground mt-2 text-[15px] leading-7">{product.valueProp}</p>

      <div className="bg-muted border-border relative mt-5 aspect-[4/3] w-full overflow-hidden rounded-2xl border">
        <Image
          src={product.imageSrc}
          alt={`${product.name} 대표 이미지`}
          fill
          priority
          className="object-cover"
          sizes="(max-width: 512px) 100vw, 512px"
        />
      </div>

      {/* 신뢰 배지 스트립 */}
      <ul className="mt-4 flex flex-wrap gap-2">
        {product.trustBadges.map((badge) => (
          <li
            key={badge}
            className="border-border text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium"
          >
            <ShieldCheck className="text-primary size-3.5" aria-hidden />
            {badge}
          </li>
        ))}
      </ul>
    </section>
  );
}
