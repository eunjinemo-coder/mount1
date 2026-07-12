import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * admin 단위 테스트 — 순수 store 운영 코어(payment/shipment/cron/notify 어댑터 계약) 대상.
 * server-only·next 런타임 의존 파일은 범위 밖(코어는 DI 로 격리). '@/' 별칭을 tsconfig 와 정합.
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
