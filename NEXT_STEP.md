# Next Step

다음 세션 진입 시 바로 이어갈 작업. 3줄 원칙.

---

## 다음 세션 첫 작업 (우선순위)

1. ~~**Step 4 Supabase migration 본문 작성**~~ — **완료 (2026-04-25)** · 4 파일 작성: `0001_init.sql` (ERD §3 **21 테이블 전체** + 뷰 2 + 트리거 3 + app_settings seed 10키) · `0002_rls.sql` (RLS 활성 21 + 헬퍼 5 + 정책 **55**) · `0003_cron.sql` (pg_cron 3 스케줄 + stub 함수 — **`migrations_pending/` 격리**, prod Pro 전환 후 활성화) · `0004_hooks.sql` (Custom Access Token Hook · 4키 주입). **은진님 적용 대기**:
   - dev (Free): `cd D:\MOUNT1 && supabase db push` → 0001·0002·0004 만 적용
   - Dashboard → Auth Hooks → "Custom Access Token" → `public.custom_access_token_hook` 활성화
   - prod 는 D-1 (2026-05-02) Pro 전환 후 `migrations_pending/0003_cron.sql` → `migrations/` 이동 + `supabase db push`
2. **Tailwind v3 + shadcn/ui New York preset 통합** — `packages/config/tailwind.preset.ts` 본문 · 양쪽 앱 `globals.css` `@tailwind` directives · `packages/ui/src/button.tsx` variants 재작성 (`TD-002·TD-004` 동시 상환).
3. **Sentry + PostHog 초기 연결** — 각 앱 `sentry.client.config.ts` / `sentry.server.config.ts` + `beforeSend` PII scrubber (전화·이메일 정규식) · `packages/lib/src/analytics.ts` 신규 + PostHog init (`logger.ts` 의 `TD-001` 동시 상환).

## 은진님 세션 외 작업

### ✅ 완료
- [x] GitHub `eunjinemo-coder/mount1` private 생성 + main 브랜치 7커밋 push
- [x] Supabase 프로젝트 2개 (`mountpartners-dev` · `mountpartners-prod`) ap-northeast-2 생성
- [x] Supabase CLI 설치 · `supabase login` · `supabase link --project-ref nzphbeookxotdjzishqn`
- [x] dev publishable/secret/JWT Secret → `apps/{driver,admin}/.env.local` 반영

### 🔐 D-1 (2026-05-02) 전 필수
- [ ] dev + prod secret key · JWT Secret **다시 rotate** (세션 로그 위생 차원)
- [ ] 재발급 후 로컬 `.env.local` 직접 교체 · Vercel Env Variables 에 prod 키 입력

### 📦 이후 외부 서비스 가입 (Day -7~-4)
- [ ] Vercel 팀 + 프로젝트 2개 (`mount-driver` / `mount-admin`) GitHub `eunjinemo-coder/mount1` 연결 · Root Directory 각각 `apps/driver` · `apps/admin`
- [ ] Cloudflare R2 버킷 3개 (`mount-photos-hot/warm/cold`)
- [ ] `mountpartners.cloud` 도메인 소유 확인 + Cloudflare DNS 3 CNAME (`app.` · `admin.` · `photos.`)
- [ ] Solapi 가입 + 발신번호 인증 + 카카오 플친 연결 (승인 1~3일 소요)
- [ ] Kakao Developers 앱 2개 (Map + 알림톡) · Web 플랫폼 도메인 등록
- [ ] PortOne v2 가맹점 + 이노페이 온보딩 (1~2일)
- [ ] Sentry 프로젝트 2개 · PostHog 프로젝트 1개 · Better Stack uptime
- [ ] (선택) Docker Desktop 설치 — 로컬 `supabase start` 용 (없어도 CLI + 원격 dev DB 로 개발 가능)
- [ ] (선택) Next.js 16 `middleware.ts` → `proxy.ts` rename 승인 여부 (TD-009)

## 세션 복구 포인트

**다음 세션 첫 메시지 (복사해서 쓰세요)**:
```
D:\MOUNT1 작업 이어가자. git pull 로 동기화 후 NEXT_STEP.md 읽고
첫 항목 (Supabase migration 본문 작성) 진입. 기획서 참조는
D:\walltvprowiki\13_PROJECT_MANAGEMENT\MOUNTPARTNERS_APP\
02_IA\02_ERD.md §3, 04_PERMISSIONS.md §5.
```

**로컬 환경 확인 명령** (다음 세션 시작 시):
- `cd D:\MOUNT1 && git pull && pnpm install` — 업데이트 반영
- `pnpm typecheck && pnpm lint && pnpm build` — 증빙 3종 재검증
- `supabase projects list` — Supabase CLI 로그인 상태 확인

**현재 스캐폴드 검증 결과**:
- typecheck ✅ (5/5 · 12s) · lint ✅ (5/5 · 13s) · build ✅ (2/2 · 34s · Next.js 16.2.4)
- 7 커밋 · 61+ 파일 · 3,200+ LOC
- 원격: https://github.com/eunjinemo-coder/mount1

**참고 문서**: `_DECISIONS.md` (16건) · `_RISKS.md` (R-001~R-005) · `_TECH_DEBT.md` (TD-001~TD-009)
