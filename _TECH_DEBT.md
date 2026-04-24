# Tech Debt

상환 필요한 기술 부채. 해소되면 `## 상환 완료` 섹션으로 이동 후 날짜 기록.

---

## 미상환

### TD-001 · logger · `console.*` 직접 호출
- 위치: `packages/lib/src/logger.ts`
- 원인: Sentry / Better Stack 미설정 상태에서 최소 로깅 확보
- 상환: Step 6 관측성 단계에서 `Sentry.addBreadcrumb` / `Sentry.captureException` 로 교체. console 의존 제거.

### TD-002 · Tailwind 미통합
- 위치: `apps/{driver,admin}/app/globals.css`, `packages/config/tailwind.preset.ts`
- 원인: 스캐폴딩 단계 복잡도 제어
- 상환: 차기 세션 별도 Step — Tailwind v3 + `packages/config/tailwind.preset.ts` 본문 + shadcn/ui New York preset 통합. 양쪽 앱 globals.css 에 `@tailwind` directives 추가.

### TD-003 · Supabase migration 본문 없음
- 위치: `supabase/migrations/`
- 원인: `02_IA/02_ERD.md` §3 의 21 테이블 DDL 이관 분량
- 상환: Step 4 (Day -12 예정) 에 Phase 1 8 테이블 + RLS 24 정책 + pg_cron 3 스케줄 + Custom Access Token Hook.

### TD-004 · Button 컴포넌트 Tailwind class 미주입
- 위치: `packages/ui/src/button.tsx`
- 원인: TD-002 종속
- 상환: TD-002 와 동시 처리 (shadcn/ui Button variants 복제).

### TD-005 · `types.generated.ts` placeholder
- 위치: `packages/db/src/types.generated.ts`
- 원인: Supabase 프로젝트 미존재
- 상환: 은진님 Supabase 프로젝트 생성 후 `pnpm --filter @mount/db db:types` 실행으로 덮어쓰기.

### TD-006 · ESLint Next.js 플러그인 미통합
- 위치: `apps/{driver,admin}/eslint.config.mjs`
- 원인: `eslint-config-next` flat config 호환성 이슈 회피
- 상환: CI/CD 단계 (Step 5) 에서 `@eslint/compat` 또는 `eslint-config-next@16` 확인 후 통합. `next/core-web-vitals` + `next/typescript` 규칙 로드.

### TD-007 · PWA Service Worker 미통합
- 위치: `apps/driver/`
- 원인: `next-pwa` vs `@serwist/next` 선택 미정
- 상환: Day -7 ~ -5 구간. manifest.json 은 이미 작성 완료이므로 서비스 워커만 추가.

### TD-009 · middleware.ts → proxy.ts 규약 변경 (Next.js 16)
- 위치: `apps/{driver,admin}/middleware.ts`
- 원인: Next.js 16 에서 `middleware` 파일 규약 deprecated → `proxy` 로 rename 권장
- 증거: 빌드 시 경고 `The "middleware" file convention is deprecated. Please use "proxy" instead`
- 상환: 기획서 `06_ROADMAP/05_SCAFFOLDING.md §2.2` 가 `middleware.ts` 로 명시 중. 은진님 확인 후 (1) 기획서 업데이트 + 코드 rename, (2) 코드 유지 + 경고 suppress 중 택. 헌법 제1조 Spec-First 에 따라 기획서 업데이트가 먼저.
- 참조: https://nextjs.org/docs/messages/middleware-to-proxy

### TD-008 · Icon 에셋 부재
- 위치: `apps/driver/public/icons/{192,512,512-maskable,180}.png`
- 원인: 로고 아트워크 미확정
- 상환: partner-landing `public/logo-mark.png` 기반 자동 생성 스크립트 또는 수동 export. manifest.json 이 이미 참조 중이므로 아이콘 누락 시 404. PWA 미완이므로 당장은 경고만.
