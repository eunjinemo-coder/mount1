import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * 스토어 단위 테스트 — 순수 로직(검증/가격/에러매핑/서비스/쿠키서명) 대상.
 * 컴포넌트 렌더 테스트는 범위 밖(로직 우선). '@/' 별칭을 tsconfig 와 정합.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'app/**/*.test.ts'],
    globals: false,
  },
});
