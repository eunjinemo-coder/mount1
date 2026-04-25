import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: 'center',
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          borderRadius: 96,
          color: '#3b82f6',
          display: 'flex',
          fontSize: 240,
          fontWeight: 800,
          height: '100%',
          justifyContent: 'center',
          letterSpacing: '-0.05em',
          width: '100%',
        }}
      >
        MP
      </div>
    ),
    { ...size },
  );
}
