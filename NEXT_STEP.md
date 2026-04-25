# Next Step

다음 세션 진입 시 바로 이어갈 작업. 3줄 원칙.

---

## 다음 세션 첫 작업 (우선순위)

1. ~~**Step 4 Supabase migration 본문 작성**~~ — **완료 (2026-04-25)** · 4 파일 작성: `0001_init.sql` (ERD §3 **21 테이블 전체** + 뷰 2 + 트리거 3 + app_settings seed 10키) · `0002_rls.sql` (RLS 활성 21 + 헬퍼 5 + 정책 **55**) · `0003_cron.sql` (pg_cron 3 스케줄 + stub 함수 — **`migrations_pending/` 격리**, prod Pro 전환 후 활성화) · `0004_hooks.sql` (Custom Access Token Hook · 4키 주입). **은진님 적용 대기**:
   - dev (Free): `cd D:\MOUNT1 && supabase db push` → 0001·0002·0004 만 적용
   - Dashboard → Auth Hooks → "Custom Access Token" → `public.custom_access_token_hook` 활성화
   - prod 는 D-1 (2026-05-02) Pro 전환 후 `migrations_pending/0003_cron.sql` → `migrations/` 이동 + `supabase db push`
2. ~~**Tailwind v3 + shadcn/ui New York preset 통합**~~ — **완료 (2026-04-25)** · Tailwind v3.4.19 + shadcn New York · 토큰 이중 시스템(shadcn HSL + 08 hex 병존) · Brand Blue 매핑 · Button cva 6×4 variants · PostCSS chain (postcss-import → tailwindcss → autoprefixer) · safe-area helper · Pretendard 폰트 · dark mode skeleton. typecheck 5/5 · lint 5/5 · build 2/2 통과. `TD-002` · `TD-004` 동시 상환.
3. ~~**Sentry + PostHog 초기 연결**~~ — **완료 (2026-04-25)** · `@sentry/nextjs` 9.47.1 + `posthog-js` 1.205+. wrapper 패턴 (`@mount/lib/error-reporting`, `@mount/lib/analytics`). PII scrubber (한국 휴대폰·이메일 정규식). instrumentation-client.ts + instrumentation.ts (Next.js 16 신규 패턴). DSN/KEY noop 가드 — 가입 전에도 빌드 통과. `logger.ts` 가 자동으로 Sentry breadcrumb/exception 전송 → `TD-001` 상환. typecheck 5/5 · lint 5/5 · build 2/2 통과.
4. ~~**품앗이 R1 Foundation 5종 외주**~~ — **완료 (2026-04-25)** · Codex 5 병렬: `@mount/db` Supabase 클라이언트 3종 · `@mount/lib/auth` 인증 helpers 5파일 · `@mount/ui` shadcn 컴포넌트 7종 · `@mount/types` Zod 스키마 5종(신규 패키지) · driver PWA Service Worker (`@serwist/next`). typecheck 6/6 · lint 6/6 · build 2/2 통과 (driver `/offline` 라우트 정상). `TD-007` 동시 상환.

## R2 완료 (2026-04-25)

5. ~~**Driver login (A01)**~~ — Codex 외주 ✅ — page/actions/login-form 3 파일, useActionState + h-12 큰 터치 영역
6. ~~**Admin login (B01)**~~ — Claude 직접 ✅ — 5역할 select(한글 라벨) + 잠금 안내 메시지
7. ~~**Driver Today (A02 리스트)**~~ — Claude 직접 ✅ — `v_technician_today` 조회, OrderCard + Empty, 통화 필요 Badge, ChevronRight
8. ~~**Admin Today (B02)**~~ — Claude 직접 ✅ — 4 KPI 카드 + 미배차 배너 + 기사별 막대 (Promise.all 4 쿼리, KST→UTC 변환)

> 품앗이 R2 결과: 4 task 중 1 task(driver-login) 만 codex 성공, 3 task 는 timeout/탐색 과다로 실패 → Claude 직접 작성 fallback. driver-login 은 codex 산출물 그대로 채택 (109 LOC).

## R3 완료 (2026-04-25)

9. ~~**Driver Order Detail (A04)**~~ — Claude 직접 ✅ — 시각·고객·TV·옵션 카드 + status 별 액션 버튼
10. ~~**Driver Start (A06)**~~ — Claude 직접 ✅ — RPC `rpc_technician_start_installation` 호출 + 사진 부족 에러 안내
11. ~~**Driver Complete (A08)**~~ — Claude 직접 ✅ — 무타공/타공 전환 라디오 + RPC `rpc_technician_complete` + 합의 방법 select
12. ~~**Admin Dispatch (B05)**~~ — Claude 직접 ✅ — 미배차 + 활성 기사 매칭 카드 + RPC `rpc_admin_dispatch` 호출
13. ~~**0005_rpc.sql RPC 본문**~~ — Claude 직접 ✅ — start_installation·complete·log_call·admin_dispatch·depart·arrive 6 RPC

> 품앗이 R3 결과: codex 0/3 성공 → 전부 Claude 직접 (R2 와 동일 fallback). codex worker 의 Windows 호환성 한계 또는 instruction 효율 문제. R4부터 codex 사용 재고려.

## 은진님 액션 — 0005_rpc.sql dev 적용 + types regenerate

```bash
cd D:\MOUNT1
supabase db push                          # 0005_rpc.sql dev 에 적용
pnpm --filter @mount/db db:types:dev      # 새 RPC 타입 generated 에 추가
```

이후 `callRpc` 헬퍼는 그대로 작동 (string 인자 받기 때문). typecheck 도 자동 통과.

## 1차 중간점검 완료 (2026-04-25/26)

- 보고서: `_REVIEW_REPORTS/MIDPOINT_CHECK_2026-04-25.md`
- 4 에이전트 dispatch (code-reviewer · security-reviewer · general-purpose · e2e-runner)
- P0 6건 자동 수정 완료 (코드 5건 + DB migration 0006_security_fix.sql)
- P1 일부 자동 수정 (라우트 dead-end 3건 회피)
- 와이어프레임 평균 매칭률 ~48% → R4 에서 보완

## R4 후보 (Lead PM 자율 진행)

14. **Driver Photos (A07)** — 6 슬롯 사진 업로드 + Supabase Storage `photos-hot` 버킷 + EXIF 추출
15. **Driver Cancel (A10)** — 취소 사유 폼 + cancellation_reports insert + 서명 캔버스
16. **Admin Order List (B03)** — 필터/정렬 가능한 전체 주문 테이블
17. **Driver Pre-call (A05)** — 30분 전 통화 화면 + RPC `rpc_technician_log_call`
18. **관리자 역할 서버 결정** — admin_users.username 컬럼 추가 + 서버에서 role 확정 (P1-S2 보안 보강)
19. **글로벌 헤더·하단 탭바·사이드바** — 와이어프레임 부합도 향상

R4 전제 (은진님 액션):
- `cd D:\MOUNT1 && supabase db push` (0005_rpc.sql + 0006_security_fix.sql 적용)
- `pnpm --filter @mount/db db:types:dev`
- Supabase Dashboard → Storage → 버킷 `photos-hot` 생성 (Photos R4 진입 전)

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
