# Decisions

코드·인프라·라이브러리 결정 기록 (로컬 저장소 범위). 기획 결정은 `D:\walltvprowiki\13_PROJECT_MANAGEMENT\MOUNTPARTNERS_APP\` 내 별도 문서에 기록.

포맷: `YYYY-MM-DD · <영역> · <결정> · <사유 요약>` (헌법 제10조)

---

## 2026-04-24 · Phase 0 Day 0.1 초기 스캐폴딩

- 2026-04-24 · 인프라 · 프로젝트 디렉토리 `D:\MOUNT1\` 확정 · 은진님 지시. 기존 `D:\mountpartners-app\` 는 이전 Codex 세션 산출물로 간섭 회피 위해 완전 무시.
- 2026-04-24 · 도구 · pnpm 10.23.0 채택 · 로컬 설치본 유지. `_FIRST_SESSION_PROMPT.md §5.1` 의 "9.x" 명시와 괴리 있으나 10.x 안정 릴리스이며 `packageManager` 필드 고정으로 버전 단일화.
- 2026-04-24 · 도구 · Turborepo 2.x + `tasks` 키 사용 · `06_ROADMAP/05_SCAFFOLDING.md §1.2` 의 `pipeline` 은 Turbo 1.x deprecated 표기. 2.x 표준 마이그레이션.
- 2026-04-24 · 도구 · 린터 ESLint 9 + Prettier 3 채택 · `05_TECH_STACK/01_STACK_DECISIONS.md §1` "Biome (or ESLint+Prettier)" 중 `_FIRST_SESSION_PROMPT` Step 1 명시 대로.
- 2026-04-24 · 구조 · `packages/` 4종 (ui/db/config/lib) · `06_ROADMAP/05_SCAFFOLDING.md §1` (source_of_truth:true) 기준. `_FIRST_SESSION_PROMPT` Step 3 의 7-패키지(events/types/i18n/api-client 추가)는 Phase 1 후반 세분화 분기로 연기.
- 2026-04-24 · 품질 · `tsconfig.base.json` 에 `noUncheckedIndexedAccess: true` 활성 · 헌법 제4조 타입 안전 강화 (배열·객체 인덱싱 시 undefined 반영).
- 2026-04-24 · 품질 · ESLint `no-console: error` + `logger.ts` 만 예외 (file-level eslint-disable) · 운영 룰 2.7 console.log 금지. logger 래퍼로 일원화.
- 2026-04-24 · 품질 · ESLint `@typescript-eslint/no-explicit-any: error` · 헌법 제4조 any 금지.
- 2026-04-24 · 보안 · `apps/{driver,admin}/next.config.ts` 에 기본 응답 헤더 (X-Content-Type-Options, X-Frame-Options=DENY, HSTS, Referrer-Policy, Permissions-Policy) 주입 · 헌법 제3조 Security-First. CSP 본문은 Supabase URL 확정 후 추가.
- 2026-04-24 · 보안 · admin 에 `X-Robots-Tag: noindex, nofollow, noarchive` + robots.txt `Disallow: /` · 운영 콘솔 비공개 원칙.
- 2026-04-24 · 보안 · driver 도 robots.txt `Disallow: /` · 기사 전용 앱 · SEO 대상 아님.
- 2026-04-24 · 범위 · Tailwind CSS 통합 차기 세션 연기 · 스캐폴딩 단계 복잡도 제어. `TD-002` 로 기록.
- 2026-04-24 · 범위 · Supabase migration 본문 차기 세션 연기 · 이번 세션은 `supabase/` 폴더 skeleton + README 만. `TD-003` 으로 기록.
- 2026-04-24 · 범위 · eslint-config-next 통합 차기 세션 연기 · flat config 호환성 이슈 회피. `TD-006` 으로 기록.
