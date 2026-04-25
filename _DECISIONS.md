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
