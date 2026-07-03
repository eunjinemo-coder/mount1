import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * @mount/lib 단위 테스트 — 순수 로직(notify 파이프라인 등) 대상. node 환경.
 * 'server-only' 는 node 조건에서 import 시 throw 하므로 빈 스텁으로 alias(서버전용 순수
 * 모듈 solapi.ts/config.ts 를 테스트에서 로드 가능하게).
 */
export default defineConfig({
  resolve: {
    alias: {
      'server-only': fileURLToPath(new URL('./test/server-only-stub.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: false,
  },
});
