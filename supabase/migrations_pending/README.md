# supabase/migrations_pending/

**Supabase CLI 가 인식하지 않는 보관 폴더**. `supabase db push` 는 `migrations/` 직속 `.sql` 파일만 처리하므로 여기 있는 파일은 적용되지 않는다.

## 보관 사유

특정 환경 조건이 충족돼야 적용 가능한 마이그레이션을 dev/prod 차이 때문에 일시 격리.

## 현재 보관 파일

### `0003_cron.sql` — pg_cron 스케줄

- **요건**: Supabase **Pro 플랜 이상** (Free 에서는 `pg_cron` 확장 활성화 불가)
- **현황**: dev 프로젝트(`mountpartners-dev` · `nzphbeookxotdjzishqn`) 가 Free 플랜이라 격리. prod (`mountpartners-prod` · `rydmceypkospgzhvfpyx`) 는 D-Day 전 Pro 전환 예정.
- **활성화 절차** (prod Pro 전환 직후):
  ```bash
  cd D:\MOUNT1
  mv supabase/migrations_pending/0003_cron.sql supabase/migrations/0003_cron.sql
  supabase link --project-ref rydmceypkospgzhvfpyx
  supabase db push
  ```
- **의존성**: `0001_init.sql` 의 `audit_events` 테이블만 필요. `0002_rls.sql` · `0004_hooks.sql` 와는 독립.
- **dev 가 Pro 로 전환되면**: dev 에도 동일 절차로 활성화 (link target 만 dev 로 변경).

## 일반 원칙

- `migrations_pending/` 에서 `migrations/` 로 이동할 때 **순번 유지** (0003 자리 비우지 않음).
- 이동 시점에 본문 수정이 필요하면 별도 commit 으로 기록 후 push.
- 격리된 채로 본문이 진화하면 활성화 시점 재검토 (트랜잭션 안전성·외부 의존 컬럼).
