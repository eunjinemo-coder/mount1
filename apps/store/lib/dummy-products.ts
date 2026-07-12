/**
 * R2 더미 상품 데이터 — apps/store 랜딩 품질 상세페이지용.
 *
 * 실 데이터는 R1 마이그레이션 store_products(content jsonb) 시딩 이후 대체 예정.
 * slug 는 DB seed 와 동일하게 맞춰둠 — 전환 시 조회 코드만 교체.
 *
 * TODO(R3, 실자료): 아래 카피·스펙·수치는 은진님 자료(SKU·판매가/도매가·제품 사진·
 *   스펙·시공 실적) 수령 후 실측값으로 교체한다. `PLACEHOLDER` 주석이 붙은 필드는
 *   검증되지 않은 예시 수치이므로 배포 전 반드시 확정 필요.
 */

export interface DummyPriceTier {
  minQty: number;
  unitPrice: number;
}

/** 기사 관점 페인 포인트 (공감/문제 섹션) */
export interface PainPoint {
  title: string;
  body: string;
}

/** 품질 증거 카드 (구조·소재 포인트). icon 은 QualityEvidence 에서 lucide 로 매핑 */
export interface QualityPoint {
  icon: QualityIconKey;
  title: string;
  body: string;
}

export type QualityIconKey = 'shield' | 'anchor' | 'ruler' | 'lock' | 'layers' | 'wrench';

/** 시공 사진 갤러리 항목. scene 이 SVG 플레이스홀더 변형을 결정 */
export interface GalleryItem {
  scene: GallerySceneKey;
  caption: string;
}

export type GallerySceneKey = 'living' | 'bedroom' | 'commercial' | 'detail';

export interface SpecRow {
  label: string;
  value: string;
}

export interface FaqItem {
  q: string;
  a: string;
}

export interface DummyProduct {
  slug: string;
  name: string;
  /** 사이즈/인치 호환 요약 (카드·히어로 라벨) */
  sizeRange: string;
  basePrice: number;
  priceTiers: DummyPriceTier[];
  stock: number;
  imageSrc: string;

  /** 히어로 한줄 가치제안 */
  valueProp: string;
  /** 신뢰 배지 — 검증 가능한 정성적 문구만 사용(수치 클레임 금지, 확정 실적 확보 전까지) */
  trustBadges: string[];
  painPoints: PainPoint[];
  qualityPoints: QualityPoint[];
  gallery: GalleryItem[];
  /** 실 시공 사진 확보 여부 — false 인 동안 갤러리 섹션 자체를 미노출(플레이스홀더 노출 방지) */
  hasRealGallery: boolean;
  spec: SpecRow[];
  faq: FaqItem[];
}

const COMMON_FAQ: FaqItem[] = [
  {
    q: '세금계산서 발행되나요?',
    a: '네. 사업자 대상 전자세금계산서를 발행합니다. 주문 시 사업자번호를 입력하시면 입금 확인 후 국세청 전자세금계산서로 발행해 드립니다. 개인 구매도 가능합니다.',
  },
  {
    q: '대량으로 받으면 단가가 더 내려가나요?',
    a: '10개·50개 구간 도매가는 주문서에서 자동 적용됩니다. 팔레트 단위(수백 개 이상) 상시 납품이나 정기 발주는 별도 단가를 드리니 대량 견적 문의를 남겨주세요.',
  },
  {
    q: '주문하면 언제 출고되나요?',
    a: '영업일 기준 오후 2시 이전 입금 확인 건은 당일, 이후 건은 익영업일 출고합니다. 도서산간을 제외하면 출고 후 1~2일 내 도착합니다. 운송장은 SMS로 안내드립니다.',
  },
  {
    q: 'A/S는 어떻게 되나요?',
    a: '자재 하자는 수령일 기준 1년간 무상 교체합니다. 시공 후 처짐·이탈 등 구조 문제는 사진 확인 후 신속히 교체 자재를 보내드립니다. 시공 불량과 자재 하자 구분이 애매하면 함께 확인해 처리합니다.',
  },
  {
    q: '1개만 주문할 수 있나요?',
    a: '네. 1개부터 주문 가능합니다. 현장 테스트용으로 먼저 한두 개 써보시고 물량을 늘리는 기사분이 많습니다.',
  },
];

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
    valueProp:
      '석고보드든 콘크리트든, 무타공으로 55인치까지 흔들림 없이 잡아주는 시공 전용 브라켓입니다.',
    trustBadges: [
      '무타공 전용 설계', // TODO(은진님 실수치): 실제 시공건수·후기 확정 후 교체
      '자재 하자 1년 무상 교체',
      '전국 익영업일 출고',
    ],
    painPoints: [
      {
        title: '처짐 한 번에 재방문 비용',
        body: '설치 몇 달 뒤 처짐·흔들림으로 다시 부르면, 자재값보다 왕복 인건비와 잃는 신뢰가 훨씬 큽니다.',
      },
      {
        title: '브라켓 하나에 TV까지 책임',
        body: '싸게 산 브라켓이 파손되면 붙어 있던 TV까지 물어주게 됩니다. 결국 가장 비싼 자재가 됩니다.',
      },
      {
        title: '박스마다 다른 규격',
        body: '홀 간격·볼트 규격이 로트마다 달라 현장에서 맞추느라 시간 버리신 적, 한 번쯤 있으실 겁니다.',
      },
    ],
    qualityPoints: [
      {
        icon: 'shield',
        title: '아연도금 강판 2.5T',
        body: '휨·부식에 강한 2.5mm 아연도금 강판. 하중을 면으로 분산해 장기 처짐을 억제합니다.',
      },
      {
        icon: 'anchor',
        title: '무타공 압착 구조',
        body: '벽면 손상 없이 압착·보강 방식으로 고정. 타공이 어려운 현장에서도 규격 시공이 됩니다.',
      },
      {
        icon: 'ruler',
        title: 'VESA 통합 홀 패턴',
        body: '100×100부터 400×400까지 한 브라켓으로 대응. 모델마다 자재 바꿔 들일 필요가 없습니다.',
      },
      {
        icon: 'lock',
        title: '안전 락 후크',
        body: '거치 후 자동으로 걸리는 이탈 방지 후크. 아이·반려동물 있는 가정에서도 안심입니다.',
      },
    ],
    gallery: [
      { scene: 'living', caption: '거실 55인치 무타공 시공' },
      { scene: 'bedroom', caption: '침실 43인치 벽면 시공' },
      { scene: 'commercial', caption: '상업 공간 다중 설치' },
      { scene: 'detail', caption: '압착 유닛 고정 디테일' },
    ],
    hasRealGallery: false, // TODO(실사진 확보 후 true 전환)
    spec: [
      { label: '호환 TV', value: '32~55인치' },
      { label: '최대 하중', value: '45kg' },
      { label: '벽면 재질', value: '석고보드 · 콘크리트 · 조적 (무타공 압착 + 보강)' },
      { label: 'VESA 규격', value: '100×100 ~ 400×400' },
      { label: '소재', value: '아연도금 강판 2.5T' },
      { label: '구성품', value: '본체 브라켓 · 압착 유닛 2 · 안전 후크 · 수평계 · 시공 가이드' },
    ],
    faq: COMMON_FAQ,
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
    valueProp:
      '85인치 대형 패널까지, 무타공으로 안전 기준을 지키며 잡아주는 프로 시공용 브라켓입니다.',
    trustBadges: [
      '무타공 전용 설계', // TODO(은진님 실수치): 실제 시공건수·후기 확정 후 교체
      '자재 하자 1년 무상 교체',
      '대형 패널 하중 시험 통과',
    ],
    painPoints: [
      {
        title: '대형 TV일수록 커지는 리스크',
        body: '75~85인치는 무게가 곧 사고로 이어집니다. 브라켓 등급이 낮으면 처짐이 아니라 낙하가 됩니다.',
      },
      {
        title: '재시공 한 번이 하루를 잡아먹음',
        body: '대형 패널은 2인 작업이 기본입니다. 자재 문제로 다시 나가면 그날 다른 현장이 밀립니다.',
      },
      {
        title: '고객이 가장 예민한 자리',
        body: '거실 정면 대형 TV는 미세한 기울기·틈도 바로 클레임이 됩니다. 자재부터 여유가 있어야 합니다.',
      },
    ],
    qualityPoints: [
      {
        icon: 'shield',
        title: '아연도금 강판 3.0T',
        body: '스탠다드보다 두꺼운 3.0mm 강판. 대형 패널 하중을 넉넉한 안전율로 받아냅니다.',
      },
      {
        icon: 'anchor',
        title: '이중 압착 보강 구조',
        body: '압착 유닛을 4점으로 배치해 대형 패널의 모멘트를 분산. 무타공에서도 규격 하중을 확보합니다.',
      },
      {
        icon: 'ruler',
        title: 'VESA 200~600 대응',
        body: '200×200부터 600×400까지. 삼성·LG 대형 라인 대부분을 한 브라켓으로 커버합니다.',
      },
      {
        icon: 'lock',
        title: '2단 안전 락',
        body: '거치 후 상·하 2단으로 잠기는 락 구조. 대형 패널 이탈을 이중으로 방지합니다.',
      },
    ],
    gallery: [
      { scene: 'living', caption: '거실 75인치 무타공 시공' },
      { scene: 'commercial', caption: '매장 사이니지 85인치' },
      { scene: 'bedroom', caption: '안방 65인치 벽면 시공' },
      { scene: 'detail', caption: '4점 압착 보강 디테일' },
    ],
    hasRealGallery: false, // TODO(실사진 확보 후 true 전환)
    spec: [
      { label: '호환 TV', value: '55~85인치' },
      { label: '최대 하중', value: '70kg' },
      { label: '벽면 재질', value: '석고보드 · 콘크리트 · 조적 (무타공 이중 압착 + 보강)' },
      { label: 'VESA 규격', value: '200×200 ~ 600×400' },
      { label: '소재', value: '아연도금 강판 3.0T' },
      { label: '구성품', value: '본체 브라켓 · 압착 유닛 4 · 2단 안전 락 · 수평계 · 시공 가이드' },
    ],
    faq: COMMON_FAQ,
  },
];

export function getDummyProductBySlug(slug: string): DummyProduct | undefined {
  return DUMMY_PRODUCTS.find((product) => product.slug === slug);
}

/** 도매 구간 총 절감액 = (1개 기준가 − 구간 단가) × 수량 */
export function calcTierSavings(basePrice: number, unitPrice: number, qty: number): number {
  return Math.max(0, (basePrice - unitPrice) * qty);
}

/** 개당 절감액 */
export function calcUnitSavings(basePrice: number, unitPrice: number): number {
  return Math.max(0, basePrice - unitPrice);
}
