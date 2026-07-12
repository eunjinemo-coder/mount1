'use client';

import { useEffect, type ReactElement } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): ReactElement {
  useEffect(() => {
    console.error('[store/global-error]', error);
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
        <div style={{ maxWidth: '380px', textAlign: 'center', padding: '1.5rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem' }}>
            오류가 발생했어요
          </h1>
          <p
            style={{
              color: '#555',
              fontSize: '0.875rem',
              lineHeight: 1.7,
              marginBottom: '1.5rem',
            }}
          >
            페이지를 불러오지 못했어요. 새로고침해 주세요.
            {error.digest ? (
              <span
                style={{
                  display: 'block',
                  marginTop: '0.5rem',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  color: '#999',
                }}
              >
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
