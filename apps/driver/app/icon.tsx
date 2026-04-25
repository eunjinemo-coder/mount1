import { ImageResponse } from 'next/og';

// Next.js 16 자동 PWA 아이콘 생성 — favicon · apple-icon · 일반 icon 모두 동일 SVG.
export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: 'center',
          background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
          borderRadius: 96,
          color: 'white',
          display: 'flex',
          fontSize: 280,
          fontWeight: 800,
          height: '100%',
          justifyContent: 'center',
          letterSpacing: '-0.05em',
          width: '100%',
        }}
      >
        M
      </div>
    ),
    { ...size },
  );
}
