import { ImageResponse } from 'next/og';

export const alt = '벽걸이프로 스토어';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// 카카오톡 링크 공유 미리보기용 — 정적 파일 없이 요청 시 생성.
export default function OpengraphImage() {
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
          width: '100%',
        }}
      >
        <div style={{ color: 'white', fontSize: 32, fontWeight: 600, opacity: 0.85 }}>
          벽걸이프로
        </div>
        <div
          style={{
            color: 'white',
            fontSize: 64,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            marginTop: 16,
            textAlign: 'center',
          }}
        >
          구멍 하나 없이, 완벽하게 걸리는 TV
        </div>
        <div style={{ color: 'white', fontSize: 28, marginTop: 28, opacity: 0.9 }}>
          벽걸이프로 스토어
        </div>
      </div>
    ),
    { ...size },
  );
}
