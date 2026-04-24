# Next Step

다음 세션 진입 시 바로 이어갈 작업. 3줄 원칙.

---

## 다음 세션 첫 작업 (우선순위)

1. **`pnpm install` + 증빙 3종** — 의존성 설치 후 `pnpm typecheck && pnpm lint && pnpm build` 3종 초록 확인. 실패 시 **최소 수정**(버전 리졸브 · 누락 의존성)으로 해결. stdout 증빙 PR 에 첨부. (Task #7)
2. **첫 Conventional Commit 4건 분할 + 원격 push** — 루트 스캐폴드 / apps / packages / governance+env 순차 커밋. (Task #8) 은진님이 GitHub repo 생성하면 `git remote add` + `push -u`.
3. **Step 4 Supabase migration 본문 작성** — `02_IA/02_ERD.md` §3 기준 Phase 1 8 테이블 DDL + `02_IA/04_PERMISSIONS.md` §5 RLS 24 정책 + pg_cron 3 스케줄 + Custom Access Token Hook. 파일 3개 (`0001_init.sql` / `0002_rls.sql` / `0003_cron.sql` / `0004_hooks.sql`).

## 은진님 세션 외 작업 (병렬 진행)

- [ ] GitHub `walltvpro/mountpartners-app` private 생성 → Repo URL 공유
- [ ] Supabase 프로젝트 2개 생성 (dev / prod, ap-northeast-2) → Dashboard URL + 프로젝트 REF + anon key + service role key
- [ ] Supabase CLI 설치 (`scoop install supabase` 또는 `npm i -g supabase`)
- [ ] Docker Desktop 설치 (로컬 `supabase start` 용)
- [ ] Cloudflare R2 버킷 3개 (`mount-photos-hot/warm/cold`)
- [ ] Cloudflare DNS 3 CNAME (`app.`, `admin.`, `photos.mountpartners.cloud`)
- [ ] Vercel 팀 + 프로젝트 2개 (`mount-driver`, `mount-admin`), GitHub 연결
- [ ] Solapi · Kakao (Map + 알림톡) · PortOne · Sentry · PostHog · Better Stack 계정 및 키 발급 (`_FIRST_SESSION_PROMPT §5.2` 참조)

## 세션 복구 포인트

- 이번 세션 최종 상태: Turborepo 모노레포 스캐폴드 완료. 3-종(apps, packages, supabase) 디렉토리 구조 + env 템플릿 + governance 문서 4종.
- 미완: `pnpm install` · 첫 커밋 · 원격 push.
- 참고: `_DECISIONS.md` · `_RISKS.md` · `_TECH_DEBT.md` (상태 동기화 헌법 제8조).
