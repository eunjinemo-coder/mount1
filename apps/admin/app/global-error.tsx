'use client';

import { useEffect, type ReactElement } from 'react';

/**
 * 루트 레이아웃 에러 — error.tsx 도 잡지 못한 치명적 에러 fallback.
 * 자체 <html> + <body> 렌더링 (root layout 자체가 깨졌을 수 있음).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): ReactElement {
  useEffect(() => {
    console.error('[admin/global-error]', error);
  }, [error]);

  return (
    <html lang="ko">
      <body
        style={{
          fontFamily: '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif',
          margin: 0,
          padding: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#fafafa',
          color: '#111',
        }}
      >
        <div style={{ maxWidth: '420px', textAlign: 'center', padding: '2rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem' }}>
            치명적인 오류가 발생했어요
          </h1>
          <p
            style={{
              color: '#555',
              fontSize: '0.875rem',
              lineHeight: 1.7,
              marginBottom: '1.5rem',
            }}
          >
            앱 전체에 문제가 발생했습니다. 새로고침하시거나 본사 운영팀에 알려 주세요.
            {error.digest ? (
              <span style={{ display: 'block', marginTop: '0.5rem', fontFamily: 'monospace', fontSize: '0.75rem', color: '#999' }}>
                ref: {error.digest}
              </span>
            ) : null}
          </p>
          <button
            onClick={reset}
            style={{
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '0.75rem 1.5rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            type="button"
          >
            새로고침
          </button>
        </div>
      </body>
    </html>
  );
}
