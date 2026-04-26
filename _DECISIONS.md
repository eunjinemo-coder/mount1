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
- 2026-04-24 · 보안 · Supabase 신 API 키 형식 채택 (`sb_publishable_*` / `sb_secret_*`) · 기존 JWT 형식 (`eyJhbGci...`) 대체. Secret 키 공개 채팅 노출 사고 후 dev/prod 둘 다 `Rotate` 로 재발급 + Vercel Env Variables 직접 입력 경로로 service_role 전달 우회. `.env.example` 포맷 샘플도 새 형식으로 갱신.
- 2026-04-24 · 인프라 · Supabase 프로젝트 2개 확정 · dev `nzphbeookxotdjzishqn` · prod `rydmceypkospgzhvfpyx` · 둘 다 ap-northeast-2 Seoul · 초기 플랜 Free (D-Day 전 prod 만 Pro 전환 예정).
- 2026-04-24 · 인프라 · GitHub 원격 레포 `eunjinemo-coder/mount1` (private) · 은진님 지시. 로컬 폴더 `D:\MOUNT1\` 과 이름 통일. 후보 변천: (1) `Parkkwangjun/mountpartners_app` → collaborator 권한 복잡도로 회피, (2) `eunjinemo-coder/mountpartners_app` → 기존 Codex 세션 잔여 내용 발견되어 간섭 회피를 위해 최종적으로 (3) `eunjinemo-coder/mount1` 로 신규 이름 선택. git user `homecance@naver.com` 유지.

## 2026-04-25 · Phase 0 Day 0.2 Supabase migration 본문

- 2026-04-25 · DB 범위 · **Phase 1 범위 = ERD §3 21 테이블 전체** 채택 (옵션 A) · 은진님 `A/OK/OK` 확정. `NEXT_STEP.md` · `supabase/README.md` 의 "Phase 1 8 테이블" 표기는 `supabase/README.md` 초안 실수로 판단 (테이블명 4개가 ERD 와 불일치). `TD-003` 원인 문구 "ERD §3 의 21 테이블 DDL 이관 분량" 이 실제 의도. 이후 Sprint M-3/M-8 에서 RLS 토글·seed 추가만 하면 되는 장점.
- 2026-04-25 · DB 네이밍 · **단일 원천 = `02_IA/02_ERD.md §3`** · `05_TECH_STACK/06_EXTENSIBILITY.md §8.2` 의 `app_users` → `admin_users`, `05_TECH_STACK/03_BACKEND_SUPABASE.md §8.1` 의 `audit_logs` → `audit_events` 로 SQL 에서 통일. 기획 문서 본문 수정은 별도 PR (본 세션 범위 외).
- 2026-04-25 · DB 보안 · `ip_whitelist` (ERD §3.18 jsonb 컬럼) 유지 · Senior Audit E1 의 `ip_allowlist` 통일은 Phase 2 작업으로 이연 (은진님 `OK`). 미들웨어·UI 네이밍도 동일 유지.
- 2026-04-25 · DB 구조 · `customers` PII 필드(name/phone/address_road/address_detail)는 `bytea` 암호화 저장 유지 · 기사용 뷰 `v_customer_for_technician` 에서는 **복호화 불필요한 평문 필드만** (phone_tail4·region·lat/lng) 노출. 04_PERMISSIONS §5.3 원문의 `c.name, c.phone, c.address` 직접 select 는 ERD `_encrypted` 스키마와 모순이라 ERD 우선. 암호화 PII 복호화는 추후 RPC(SECURITY DEFINER) + 서버키로 처리.
- 2026-04-25 · DB cron · **시간대 환산 = KST → UTC (−9h)** · Supabase DB 기본 timezone UTC · 기획서 BACKEND §7.1 의 KST 의도 시각을 UTC 크론 표현식으로 보정하여 등록 (자정/23:00/04:00 KST = 15:00/14:00/19:00 UTC). cron 규약 주석에 명시.
- 2026-04-25 · DB cron stub · 3 스케줄 함수 본문은 현재 `audit_events` 실행 기록만 남기는 **placeholder**. 실제 알고리즘 본문은 Sprint M-5 (Gini) · M-6 (R2 lifecycle) · 추후 (dispatch preview) 에서 `create or replace` 로 교체.
- 2026-04-25 · DB hook 스키마 · Custom Access Token Hook 의 `app_metadata` 스키마는 **04_PERMISSIONS §4.1** (4키: user_type · admin_role · admin_user_id · technician_id) 채택 · EXTENSIBILITY §8.2 의 `role` 단일 주입 예시는 간단화 버전으로 판단하여 본 마이그레이션에선 4키 세분화 버전 사용. RLS 헬퍼 `auth.is_admin()` · `auth.admin_role()` · `auth.technician_id()` 와 일관.
- 2026-04-25 · DB hook 권한 · `SECURITY DEFINER` + `set search_path = public` + `supabase_auth_admin` 전용 `grant execute` · RLS bypass 정책 `hook_read_admin_users` / `hook_read_technicians` 이중 안전망. 일반 role 에서 직접 실행 금지.
- 2026-04-25 · DB 적용 전략 · **0003 격리 (옵션 B)** · 은진님 선택. dev 가 Free 플랜이라 `pg_cron` 활성화 불가 → `0003_cron.sql` 을 `supabase/migrations_pending/` 별도 폴더로 이동하여 Supabase CLI 인식 차단. dev 에는 0001/0002/0004 만 push, prod Pro 전환 후 0003 을 `migrations/` 로 이동하여 4 파일 모두 push. 후보 비교: (A) dev Pro 전환 즉시 → 비용 부담 거부 / (B) 폴더 격리 → 채택 / (C) DO block exception-safe 재작성 → SQL 복잡도·트랜잭션 안전성 우려로 거부.
- 2026-04-25 · DB fix (`f18e973`) · `v_orders_dashboard.last_payment_status` 를 `payment_links.status` 기반으로 수정 · ERD §4.1 본문이 `payments.status` 참조했으나 §3.13 payments 정의에 status 컬럼 없음(SQLSTATE 42703) → 결제 lifecycle 단일 원천인 payment_links.status 로 교체. wiki 02_ERD.md §4.1 본문 정정은 working tree 에 남기고 다음 wiki 세션에서 다른 산재 변경과 묶어 commit 예정.
- 2026-04-25 · DB fix (`d2f03ac`) · RLS 헬퍼 함수 5개 (`admin_role`·`is_admin`·`is_super_admin`·`technician_id`·`has_admin_role`)를 `auth` 스키마 → `public` 스키마로 이동 · Supabase 가 auth 스키마 사용자 함수 생성 차단(SQLSTATE 42501) 하는 보안 정책 때문. `auth.jwt()` · `auth.uid()` 는 built-in 이라 호출만 유지. 04_PERMISSIONS §5.1 본문은 auth.* 로 정의되어 있으나 SQL 실현 시 public 우선. 기획서 정정은 wiki 세션 묶음.
- 2026-04-25 · DB 적용 결과 · dev (`mountpartners-dev` · `nzphbeookxotdjzishqn`) 에 0001/0002/0004 push 완료. supabase_migrations 기록 정상. Custom Access Token Hook 함수 배포 완료, Dashboard 등록은 은진님 수동 액션 대기.

## 2026-04-25 · Phase 0 Day 0.3 Tailwind v3 + shadcn/ui

- 2026-04-25 · 도구 · **Tailwind v3.4.19** 채택 (NEXT_STEP "v3 + shadcn New York" 명시 우선) · 09_COMPONENT_LIBRARY §1.2 의 "Tailwind v4: Yes" 표기는 무시 — v3 가 stable workflow 이고 jiti 기반 .ts config 안정.
- 2026-04-25 · 디자인 · **토큰 이중 시스템 채택** · shadcn HSL 컨벤션(`--primary`, `--background` 등)을 1차 (UI 컴포넌트 직접 사용) + 08_TOKEN_EXPORT hex 변수(`--color-primary-600` 등)를 2차 (Figma Token Studio sync 보존). Brand Blue 매핑: `--color-primary-600 #2563EB` ↔ `--primary 221.2 83.2% 53.3%`. base palette 는 09 §1.2 결정대로 Zinc/cool gray. `tailwind.preset.ts` 에 brand·slate alias 도 노출 (`bg-brand-600` 등 사용 가능).
- 2026-04-25 · 디자인 · 다크 모드 variables skeleton 포함 (`.dark` 와 `[data-theme="dark"]` 두 셀렉터) — Phase 2 토글 도입 전까지 미사용. 향후 `B-12` 다크모드 flag 활성 시 즉시 작동.
- 2026-04-25 · 디자인 · `tailwindcss-animate` plugin 미사용 · 의존성 최소화 차원으로 keyframes(accordion-up/down)을 preset 내 직접 정의. shadcn dialog/sheet 추가 시 충분.
- 2026-04-25 · UI · **shadcn/ui Button (cva)** 채택 · `class-variance-authority` + `@radix-ui/react-slot` + `lucide-react` 의존성 추가. 9개 spec 표준 (변형 6 × 사이즈 4 + asChild). `forwardRef` · `displayName` 포함하여 React DevTools 식별 가능.
- 2026-04-25 · 빌드 · PostCSS config 는 `.mjs` ESM 형식 (`postcss-import` + `tailwindcss` + `autoprefixer`) · `.cjs` 채택 시 ESLint flat config 의 `no-undef` 충돌 발생하여 `.mjs` 로 전환. workspace `@import '@mount/config/tokens.css'` 가 postcss-import 로 해소됨.
- 2026-04-25 · 검증 · `pnpm typecheck` 5/5 · `pnpm lint` 5/5 · `pnpm build` 2/2 (Next.js 16.2.4 Turbopack · admin 33.2s · driver 34.0s) 모두 통과. `tailwindcss-animate` 등 추가 plugin 미사용 상태에서도 Button cva variants 정상 컴파일.

## 2026-04-25 · Phase 0 Day 0.4 Sentry + PostHog 초기 연결 (TD-001 상환)

- 2026-04-25 · 관측성 · **`@sentry/nextjs` 9.47.1** 채택 · 공식 peer 는 next ^15 까지지만 next 16.2.4 에서 build·typecheck·lint 모두 통과 확인 (peer warning 무시). 9.x 는 instrumentation-client.ts / instrumentation.ts 신규 패턴 권장.
- 2026-04-25 · 관측성 · **wrapper 패턴 채택** (06_EXTENSIBILITY §7.2) · `@mount/lib/error-reporting` (captureError/captureMessage/addBreadcrumb/setUser/scrubEvent/scrubText) + `@mount/lib/analytics` (analytics.track/identify/reset/page + initAnalytics) export. 컴포넌트 코드는 `@sentry/nextjs` · `posthog-js` 직접 import 금지 — Phase 2 DataDog 등 교체 시 import 전면 수정 회피.
- 2026-04-25 · 보안 · **PII Scrubber** 도입 · 한국 휴대폰(010-1234-5678 / 01012345678 / +82-10-...) + 이메일 정규식. Sentry `beforeSend` · `beforeSendTransaction` 양쪽 적용. PIPA 준수 + 헌법 제3조 Security-First. `setUser` 도 ID + role 만 전송, 이름·전화 절대 미포함.
- 2026-04-25 · 관측성 · **DSN noop 패턴** · 환경변수(`NEXT_PUBLIC_SENTRY_DSN_DRIVER` / `NEXT_PUBLIC_SENTRY_DSN_ADMIN` / `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST`) 미설정 시 init 스킵, wrapper 호출 silent noop. Sentry/PostHog 가입 전에도 빌드·런타임 안전.
- 2026-04-25 · 관측성 · **Sampling 보수적** · `tracesSampleRate: 0.1` (10%) · `replaysSessionSampleRate: 0.0` · `replaysOnErrorSampleRate: 1.0` (에러 시 100% replay). MVP egress·요금 통제 우선, Phase 2 에 KPI 따라 조정.
- 2026-04-25 · 관측성 · **logger 상환** · `log.info/warn/error/debug` 모두 `addBreadcrumb` / `captureError` 자동 호출. console 은 dev 환경 보조 (prod 빌드에서도 stdout 보존 — Vercel 로그). TD-001 상환.
- 2026-04-25 · 관측성 · **withSentryConfig 옵션** · `silent: !CI` (로컬 빌드 조용) · `disableLogger: true` (Sentry SDK 자체 logger 무음) · `widenClientFileUpload: true` (chunk 더 많이 source map 매핑) · `sourcemaps.disable: !SENTRY_AUTH_TOKEN` (token 없으면 source map 업로드 skip). `hideSourceMaps` 는 Sentry 9 deprecated 라 제거 후 `sourcemaps.disable` 으로 대체.
- 2026-04-25 · UI · **PostHogProvider** 클라이언트 컴포넌트 도입 · `app/PostHogProvider.tsx` 가 `useEffect` 에서 1회 init. layout.tsx 가 children 을 감쌈. SPA 라우트 변경 시 page() 자동 호출은 Phase 2 (Next.js usePathname listener).
- 2026-04-25 · 검증 · typecheck 5/5 · lint 5/5 · build 2/2 (driver 51s · admin 59s) 모두 통과. peer warning 1건(@sentry/nextjs ↔ next 16) 외 이슈 없음.

## 2026-04-25 · Phase 0 Day 0.5 품앗이(Pumasi) Round 1 — Codex 5 병렬 외주

- 2026-04-25 · 도구 · **품앗이 모드 도입** · Claude=PM/감독, Codex×5=병렬 구현자. plugin: `gptaku-plugins/pumasi@1.6.0`. config: `D:/MOUNT1/pumasi.config.yaml` (5 task instruction + 게이트). Claude 토큰 절약 + 동시성 향상이 목표.
- 2026-04-25 · 도구 fix · pumasi worker.js 의 `spawn(program)` 가 Windows 에서 `codex` (sh) 직접 호출 시 ENOENT, `codex.cmd` 호출 시 EINVAL 발생 → command 를 `node C:/Windows/nvm/v22.15.1/node_modules/@openai/codex/bin/codex.js exec ...` 로 우회. ESM entry 직접 실행으로 spawn 안정.
- 2026-04-25 · R1 결과 · **5 task 모두 산출물 생성 완료** (status.json 만 stale, 실제 파일은 정상). codex 가 stderr 로 verbose 로그 출력하나 작업 자체는 완료. detached 프로세스는 수동 kill.
  - **db-clients**: `packages/db/src/{client.ts,server.ts,admin.ts,index.ts}` — Supabase 신 API 클라이언트 3종 (`@supabase/ssr@^0.5.2` + `@supabase/supabase-js@^2.45.0`). server 는 cookies adapter (getAll/setAll try-catch), admin 은 `'server-only'` import.
  - **auth-helpers**: `packages/lib/src/auth/{sign-in,sign-out,session,require-role,index}.ts` — 발급형 ID/PW 인증 (fake email `{role}_{username}@internal.mountpartners.cloud`), AppSession 타입, RedirectError·ForbiddenError 클래스.
  - **ui-components**: `packages/ui/src/{input,card,badge,skeleton,separator,dialog,sheet}.tsx` — shadcn New York 표준 7종 (cva variants · Radix dialog/separator · 'use client' directive).
  - **types-zod**: `packages/types/` 신규 패키지 + `src/{order,technician,customer,photo,installation,index}.ts` — ERD §3 기반 Zod 스키마 5종 (zod@^3.24.1).
  - **pwa-serwist**: `@serwist/next@^9.0.0` + `serwist@^9.0.0` 도입, `apps/driver/app/sw.ts`+`offline/page.tsx`, next.config 체이닝(`withSerwist(withSentryConfig)`), manifest.json 보강.
- 2026-04-25 · R1 fix (Claude 직접) · 게이트 통과 후 typecheck 2건 실패 → 1줄씩 수정.
  - `db/src/server.ts`: `setAll(cookies)` 파라미터 implicit any → 명시 타입 (`{ name; value; options?: Parameters<typeof cookieStore.set>[2] }[]`)
  - `lib/src/auth/session.ts`: 자체 정의 AppMetadata 인터페이스가 Supabase UserAppMetadata 와 호환 불가 → `Record<string, unknown>` 캐스트로 변경
- 2026-04-25 · R1 검증 · typecheck **6/6** (+1 신규 @mount/types) · lint **6/6** · build **2/2** (driver 36.8s + 30.7s tsc · admin 29.0s + 27.0s tsc) 모두 통과. driver 에 `/offline` 라우트 prerender 확인.
- 2026-04-25 · TD 상환 · TD-007 (PWA Service Worker) 동시 상환.

## 2026-04-25 · Phase 0 Day 0.6 R2 Pages (login + today)

- 2026-04-25 · 품앗이 R2 회고 · Codex 4 병렬 task 중 **1 task만 성공** (driver-login). admin-login / driver-today / admin-today 는 codex 가 PowerShell 로 파일 탐색(rg, Get-Content) 반복하다가 자체 timeout 또는 토큰 한계 도달, 실제 파일 작성 못 함. status.json stale (이전 R1 과 동일 패턴).
- 2026-04-25 · 결정 · 은진님 선택으로 **실패 3 task Claude 직접 작성** (옵션 A) · 품앗이 fallback. 헌법 "Claude=PM, Codex=구현" 원칙 일시 위반이지만 R2 가 R3 의존성이라 시간 단축 우선. 다음 라운드부터 instruction 더 짧고 명확하게(시그니처+게이트만, ERD 컨텍스트 별도 문서 link) 시도.
- 2026-04-25 · driver-login (codex) · `apps/driver/app/(driver)/login/{page,actions,login-form}.tsx` 3 파일, 109 LOC, useActionState + useTransition + h-12 큰 터치 영역 + 안전한 redirect path 검증.
- 2026-04-25 · admin-login (Claude) · 5 역할 select 한글 라벨(대표/본사CS/배차담당/쿠팡CS/감사) · 잠금 메시지 시 추가 안내(10분 후 시도 또는 본사 CS 연락).
- 2026-04-25 · driver-today (Claude) · `v_technician_today` view 사용. requireRole·RedirectError·ForbiddenError 분기. OrderCard 에 통화 필요 Badge(destructive · PhoneCall 아이콘) · 사진 진행도 6장 기준.
- 2026-04-25 · admin-today (Claude) · `v_orders_dashboard` view 사용. Promise.all 4 쿼리 (오늘 시공·진행·완료·취소). KST→UTC 변환 helper로 today range 계산. 기사별 막대는 div + inline width 만 (차트 lib 없이).
- 2026-04-25 · 의존성 fix · apps/{driver,admin}/package.json 에 `lucide-react@^0.469.0` 직접 dependency 추가 · 기존엔 @mount/ui 의 transitive 였지만 apps 가 직접 import 하면 명시 필요.
- 2026-04-25 · 검증 · typecheck 6/6 · lint 6/6 · build 2/2 통과. driver 라우트: `/`, `/login`, `/offline`, `/today`, `/api/health`. admin 라우트: `/`, `/login`, `/today`, `/api/health`.

## 2026-04-25 · Phase 0 Day 0.7 R3 시공 워크플로우 (RPC + 4 화면)

- 2026-04-25 · 품앗이 R3 회고 · Codex 3 task 모두 실패 (driver-detail / admin-dispatch / driver-workflow). PowerShell 탐색 반복 + 자체 timeout. R1 5/5 → R2 1/4 → R3 0/3 으로 성공률 하향. Windows + codex.cli 호환 한계 또는 instruction 컨텍스트 과다 추정. R4 부터는 codex 사용 시 단일 task + 시그니처+게이트만 (10줄 이하 instruction) 으로 재시도 또는 Claude 직접.
- 2026-04-25 · RPC 본문 (Claude) · `0005_rpc.sql` 작성 (343 줄). ERD §6 본문 그대로 + ERD §3 컬럼명 단일 원천 적용 (audit_events.action · notifications.recipient_type 등). 04_PERMISSIONS §6 의 `auth.technician_id()` → `public.technician_id()` 통일 (0002 헬퍼와 일관).
- 2026-04-25 · RPC 6종 (Claude) · `rpc_technician_start_installation` (사진 2장 검증) · `rpc_technician_complete` (사진 3장 + 무타공/타공 변형) · `rpc_technician_log_call` (call_logs insert) · `rpc_admin_dispatch` (수동 배차 + dispatches 이력 + 알림 큐) · `rpc_technician_depart` · `rpc_technician_arrive` (GPS 좌표 옵션). 모두 SECURITY DEFINER + authenticated 만 grant.
- 2026-04-25 · driver-detail (Claude) · 4 카드 (시각·고객·TV·옵션·가격) + status 별 액션 버튼 분기. Card·Badge·Separator 사용. v_customer_for_technician 뷰로 PII 노출 최소화.
- 2026-04-25 · driver-start (Claude) · 시작 전 안내 ol + 큰 액션 버튼 (Server Action). `missing_pre_photos` 에러 시 사용자 친화적 메시지 ("사진 메뉴에서 업로드 후 다시 시도").
- 2026-04-25 · driver-complete (Claude) · 무타공/타공 전환 라디오 카드 + 차액 자동 표시 (Intl.NumberFormat KRW) + 합의 방법 select (verbal/sms/phone). RPC 에러 매핑.
- 2026-04-25 · admin-dispatch (Claude) · 좌(미배차)/우(활성 기사) 카드 그리드 + 선택 시 border-primary 하이라이트 + 하단 sticky 확정 버튼. RPC 호출 후 router.refresh().
- 2026-04-25 · 도구 신규 · `@mount/db` 에 `callRpc<T>(client, name, args)` 헬퍼 추가 · supabase generated types 의 Functions union 이 새 RPC 추가 전 strict 타입체크 차단 회피. 0005 push + db:types regen 시 자동 정상화.
- 2026-04-25 · 검증 · typecheck 6/6 · lint 6/6 · build 2/2 통과. driver 신규 라우트: `/order/[orderId]`, `/start`, `/complete`. admin 신규: `/dispatch`. 0005_rpc.sql 은 dev push 대기.

## 2026-04-25/26 · 1차 중간점검 + Round 1 P0/P1 수정

- 2026-04-25 · 점검 방식 · `/kkirikkiri` 명령으로 4 에이전트(code-reviewer·security-reviewer·general-purpose·e2e-runner) 병렬 dispatch. Lead PM(Claude)이 통합하여 `_REVIEW_REPORTS/MIDPOINT_CHECK_2026-04-25.md` 생성.
- 2026-04-25 · 점검 결과 · 빌드 GREEN, 코드/보안 WARNING. 6 P0 + 30+ P1 + 21 P2 발견. 와이어프레임 평균 매칭률 ~48%.
- 2026-04-25 · 자율 권한 위임 · 은진님 지시: 토큰 한도 내 통합 에이전트(Lead PM)가 위임받아 검증→개선→검증 루프 자동 진행. /kkirikkiri /pumasi 활용. 사용자 개별 confirm 생략.
- 2026-04-26 · P0 fix #1 (코드) · `apps/driver/app/offline/page.tsx` React 타입 import + 한글 직접 작성 (유니코드 이스케이프 제거) + shadcn/ui Card·Button·WifiOff 아이콘으로 디자인 토큰 통일.
- 2026-04-26 · P0 fix #2 (보안+기획) · driver 화면에서 결제 금액(price_option_b/c) 노출 제거 — PERMISSIONS §5.6 위반 해소. orders 쿼리에서 price_* 필드 제외, complete 폼에서 차액 표시 제거하고 안내 문구만 노출.
- 2026-04-26 · P0 fix #3 (보안) · `apps/{driver,admin}/middleware.ts` Supabase SSR 세션 가드 구현. createServerClient + cookies adapter + 미로그인 redirect (`?redirect=` 파라미터 보존). env 누락 시 안전 모드(public path 외 redirect). admin IP whitelist 는 Phase 2 이관 결정.
- 2026-04-26 · P0 fix #4 (DB) · `supabase/migrations/0006_security_fix.sql` 작성 — auditor 권한 분리 5 정책 + read-only 5 정책 / 트리거 search_path 고정 3종 / 뷰 security_invoker 3종 / notifications.idempotency_key NOT NULL.
- 2026-04-26 · P1 fix · 라우트 dead-end 회피: start-form `/photos` → `/order/[id]` 임시 redirect, empty-state `/calendar` → `/today`, order detail on_site 의 `/cancel` 버튼 비활성화. R4 작업 시 본격 구현.
- 2026-04-26 · 의존성 · apps/{driver,admin}/package.json 에 `@supabase/ssr@^0.5.2` 명시 추가 (middleware 직접 import 시 transitive 부족 회피).
- 2026-04-26 · P1 보류 · P1-S2 (관리자 역할 서버 결정) 은 admin_users.username 컬럼 추가 + 서버 lookup 패턴 필요 — R4 후보 18번. 현재는 클라 드롭다운 유지(임시).
- 2026-04-26 · 검증 · typecheck 6/6 · lint 6/6 · build 2/2 통과. 라우트 변동 없음. 0006_security_fix.sql 은 dev push 대기.

## 2026-04-26 · R8 추천 알고리즘 + Realtime + tel: 딥링크 + 일괄 처리

- 2026-04-26 · CSP fix · admin next.config CSP 의 `'unsafe-eval'` 누락이 React dev runtime(콜스택 재구성·HMR)을 차단하던 이슈 해소 — dev 모드에서만 허용 (`process.env.NODE_ENV !== 'production'` 분기). prod 는 그대로 엄격 유지. driver 도 동일 분리 적용 (admin parity).
- 2026-04-26 · CSP fix · `connect-src` 에 Sentry region prefix(`*.ingest.us.sentry.io` / `*.ingest.de.sentry.io`) 명시 추가 — CSP wildcard 1단계 매칭 한계 보완 (기존 `*.ingest.sentry.io` 만 있어 `o<id>.ingest.us.sentry.io` envelope 차단됨).
- 2026-04-26 · login fix · `signInWithUsername` / `adminLoginAction` catch 블록의 swallow → `console.error` 로 표면화 (status/code/message). 디버깅 가시성 확보. P3 백로그 (정식 logger 통합 후 제거).
- 2026-04-26 · auth 발급 · `_HANDOFF.md` super_admin SQL 을 단일 do$$ 블록으로 완전판 교체 — auth.users INSERT 시 `aud='authenticated'` + `role='authenticated'` + `instance_id` + 6 NOT NULL 토큰 컬럼('') + auth.identities 매핑 (provider='email', email_verified=true) 모두 한 번에. 부분 INSERT 로 인한 "비번은 맞는데 로그인 실패" 함정 영구 차단. 협력기사 발급 SQL(#20) 도 동일 패턴.
- 2026-04-26 · DB · `0010_realtime_publication.sql` — orders/installations/issues 를 `supabase_realtime` publication 에 멱등 add (pg_publication_tables 체크 + foreach). RLS 그대로 적용되어 권한 없는 row 변경은 발신 안 됨.
- 2026-04-26 · UI · admin AutoRefresh 30s polling → `supabase.channel().on('postgres_changes')` 구독으로 전환. CHANNEL_ERROR/TIMED_OUT/CLOSED 시 60s polling fallback + status indicator (live/polling/connecting/error). `@mount/db/client` subpath 사용으로 server-only chain 분리(이전 navigation.ts 분리와 동일 패턴).
- 2026-04-26 · UI · driver-shell 의 activeTab prop 제거 → BottomNav 'use client' 분리 + `usePathname()` 으로 자동 결정. /order/* 진입 시 '홈' 탭 강조, /profile → '설정' 매핑. 호출부 4개 정리(today/settings/calendar/payout).
- 2026-04-26 · DB 보안 · `0011_pii_decrypt.sql` — pgcrypto pgp_sym_encrypt/decrypt + Supabase Vault 의 `pii_key` 시크릿 사용. helper `pii_key()` 는 SECDEF 함수에서만 호출 가능(direct execute revoked). `rpc_technician_get_customer_phone(uuid)` 는 본인 배차 검증 + audit_events 자동 INSERT(action='pii.phone_decrypted'). 응답은 일회성 — 클라가 저장 안 함.
- 2026-04-26 · UI · driver pre-call-form 에 '전화 걸기' 버튼 추가 — 클릭 시 server action `getCustomerPhoneAction` → `window.location.href = tel:${phone}` 단말 다이얼러 호출. 평문은 메모리에서만 사용 후 폐기 (state 저장 없음).
- 2026-04-26 · 자동화 · driver cancel/actions 가 photoIds 미지정 시 photos 테이블에서 본인 + 본 order 사진 자동 fetch → cancel_reports.photo_ids 자동 채움. RLS 가 본인 사진만 select 보장.
- 2026-04-26 · DB · `0012_recommend.sql` — `haversine_km` immutable helper + `rpc_admin_recommend_technicians(uuid, int)` returns table. 점수 = 거리(0~30, customer.address_lat/lng vs technician.last_known_lat/lng) + 등급(0~20) + 부하(0~25, today_load/daily_max_jobs) + 선호지역(0/10) + 공정성(0~15, weekly_load < 활성 평균). dispatch_admin/super_admin only · stable.
- 2026-04-26 · UI · admin dispatch/assign-form — 주문 클릭 시 추천 5명 자동 fetch + Sparkles 카드. 점수 Badge + 거리/오늘부하/주간부하/선호지역 표기. 추천 0명 ("모두 한도 초과") edge case 처리. 기존 활성 기사 목록도 그대로 유지(override 가능).
- 2026-04-26 · UI · driver today/?tab=batch placeholder → 실용 일괄 처리 표 (BatchTable). 컬럼: 선택 | 상태 | 지역·TV | 통화 | 사진 | 진행. 통화 미기록 행만 체크박스 활성. 다중 선택 → batchMarkCallsAction (manual_marked_done 순차 호출 + 부분 성공/실패 카운트).
- 2026-04-26 · 보안 · 의존성 audit · `pnpm audit --prod` 결과 2 moderate (uuid<14 via @sentry/webpack-plugin · postcss<8.5.10 via next). 둘 다 transitive — Sentry/Next 패치 릴리즈 대기. R10+ 모니터링 항목.
- 2026-04-26 · 검증 · typecheck 6/6 · lint 6/6 · build 2/2 (admin 11 + driver 14 routes) 모두 통과. R8 4 commits 누적: 9bc1dba(Realtime+autoTab+CSP+SQL) + 1324bc6(tel+cancel) + 0c475a1(B05) + dbb0ca6(A02 일괄).
