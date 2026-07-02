/**
 * R1 더미 상품 데이터 — apps/store 스캐폴드 단계용.
 * 실 데이터는 R1 마이그레이션 0021 (products 테이블) 시딩 이후 대체 예정.
 * slug 는 DB seed 와 동일하게 맞춰둠 — 전환 시 조회 코드만 교체.
 */

export interface DummyPriceTier {
  minQty: number;
  unitPrice: number;
}

export interface DummyProduct {
  slug: string;
  name: string;
  sizeRange: string;
  basePrice: number;
  priceTiers: DummyPriceTier[];
  stock: number;
  imageSrc: string;
}

export const DUMMY_PRODUCTS: DummyProduct[] = [
  {
    slug: 'no-drill-bracket-standard',
    name: '벽걸이프로 무타공 브라켓 스탠다드',
    sizeRange: '32~55인치',
    basePrice: 89000,
    priceTiers: [
      { minQty: 10, unitPrice: 79000 },
      { minQty: 50, unitPrice: 69000 },
    ],
    stock: 100,
    imageSrc: '/placeholder/bracket-standard.svg',
  },
  {
    slug: 'no-drill-bracket-pro',
    name: '벽걸이프로 무타공 브라켓 프로',
    sizeRange: '55~85인치',
    basePrice: 129000,
    priceTiers: [
      { minQty: 10, unitPrice: 115000 },
      { minQty: 50, unitPrice: 99000 },
    ],
    stock: 100,
    imageSrc: '/placeholder/bracket-pro.svg',
  },
];

export function getDummyProductBySlug(slug: string): DummyProduct | undefined {
  return DUMMY_PRODUCTS.find((product) => product.slug === slug);
}
