# Next Step

다음 세션 진입 시 바로 이어갈 작업. 3줄 원칙.

---

## 다음 세션 첫 작업 (우선순위)

1. **Step 4 Supabase migration 본문 작성** — `02_IA/02_ERD.md §3` 기준 Phase 1 8 테이블 DDL + `02_IA/04_PERMISSIONS.md §5` RLS 24 정책 + `pg_cron` 3 스케줄 + Custom Access Token Hook. 파일 4개 (`0001_init.sql` · `0002_rls.sql` · `0003_cron.sql` · `0004_hooks.sql`). 은진님 `supabase init` · `supabase link` 선행 필요.
2. **Tailwind v3 + shadcn/ui New York preset 통합** — `packages/config/tailwind.preset.ts` 본문 · 양쪽 앱 `globals.css` `@tailwind` directives · `packages/ui/src/button.tsx` variants 재작성 (`TD-002·TD-004` 동시 상환).
3. **Sentry + PostHog 초기 연결** — 각 앱 `sentry.client.config.ts` / `sentry.server.config.ts` + `beforeSend` PII scrubber (전화·이메일 정규식) · `packages/lib/src/analytics.ts` 신규 + PostHog init (`logger.ts` 의 `TD-001` 동시 상환).

## 은진님 세션 외 작업 (병렬 진행)

- [x] GitHub `eunjinemo-coder/mount1` private 생성 · main 브랜치 5커밋 push 완료
- [ ] Supabase 프로젝트 2개 생성 (dev / prod, ap-northeast-2) → Dashboard URL + 프로젝트 REF + anon key + service role key
- [ ] Supabase CLI 설치 (`scoop install supabase` 또는 `npm i -g supabase`)
- [ ] Docker Desktop 설치 (로컬 `supabase start` 용)
- [ ] Cloudflare R2 버킷 3개 (`mount-photos-hot/warm/cold`)
- [ ] Cloudflare DNS 3 CNAME (`app.` · `admin.` · `photos.mountpartners.cloud`)
- [ ] Vercel 팀 + 프로젝트 2개 (`mount-driver`, `mount-admin`), GitHub `eunjinemo-coder/mount1` 연결
- [ ] Solapi · Kakao (Map + 알림톡) · PortOne · Sentry · PostHog · Better Stack 계정 및 키 발급 (`_FIRST_SESSION_PROMPT §5.2` 참조)
- [ ] (선택) Next.js 16 `middleware.ts` → `proxy.ts` rename 승인 여부 (TD-009 참조)

## 세션 복구 포인트

- 세션 2 진입 조건: origin `eunjinemo-coder/mount1` `main` 브랜치 pull 후 `pnpm install` 로 의존성 복원.
- 증빙 3종 현재 상태: `typecheck` ✅ (12s) · `lint` ✅ (13s) · `build` ✅ (40s · Next.js 16.2.4 · React 19 Turbopack). 새 세션 시작 시 재실행으로 환경 드리프트 없는지 확인.
- 참고 문서: `_DECISIONS.md` (총 14건) · `_RISKS.md` (R-001~R-005) · `_TECH_DEBT.md` (TD-001~TD-009).
