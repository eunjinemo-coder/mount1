// vitest 전용 스텁 — 'server-only' 는 node/vitest 기본 조건에서 import 시 throw 하므로,
// 서버전용 순수 모듈(solapi.ts 등)의 단위테스트를 위해 빈 모듈로 alias 한다(vitest.config.ts).
export {};
