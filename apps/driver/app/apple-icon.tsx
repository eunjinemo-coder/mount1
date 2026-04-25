import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: 'center',
          background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
          borderRadius: 36,
          color: 'white',
          display: 'flex',
          fontSize: 100,
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
