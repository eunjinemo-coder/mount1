import { ImageResponse } from 'next/og';
import { formatCurrencyKRW } from '@mount/lib';
import { getDummyProductBySlug } from '@/lib/dummy-products';

export const alt = '벽걸이프로 스토어 — 제품 상세';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// 제품별 카카오톡 링크 공유 미리보기 — 요청 시 생성 (정적 이미지 없이도 최신 가격 반영).
export default async function OpengraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = getDummyProductBySlug(slug);

  const name = product?.name ?? '벽걸이프로 스토어';
  const priceLabel = product
    ? `${formatCurrencyKRW(product.basePrice)}부터 · ${product.sizeRange}`
    : '무타공 TV 벽걸이 브라켓';

  return new ImageResponse(
    (
      <div
        style={{
          alignItems: 'center',
          background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          justifyContent: 'center',
          padding: '0 80px',
          width: '100%',
        }}
      >
        <div style={{ color: 'white', fontSize: 28, fontWeight: 600, opacity: 0.85 }}>
          벽걸이프로 스토어
        </div>
        <div
          style={{
            color: 'white',
            fontSize: 56,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            marginTop: 20,
            textAlign: 'center',
          }}
        >
          {name}
        </div>
        <div style={{ color: 'white', fontSize: 32, marginTop: 24, opacity: 0.92 }}>
          {priceLabel}
        </div>
      </div>
    ),
    { ...size },
  );
}
