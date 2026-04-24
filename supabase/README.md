# supabase/

Supabase 프로젝트 구성 디렉토리.

## 구조

```
supabase/
├── config.toml        # supabase init 으로 자동 생성 (로컬 개발용)
├── migrations/        # DDL 타임스탬프 prefix SQL
├── functions/         # Edge Functions (Deno)
└── seed.sql           # 개발용 최소 시드
```

## 다음 단계 (은진님 작업)

1. Supabase CLI 설치: `npm i -g supabase` 또는 scoop/brew
2. `supabase login` → 계정 연결
3. `supabase init` → 이 디렉토리에 `config.toml` 생성
4. `supabase link --project-ref <DEV_PROJECT_REF>` → 원격 dev 프로젝트 연결
5. `supabase start` → 로컬 Postgres 기동 (Docker 필요)

## 마이그레이션 작성 가이드

파일명 규약: `<타임스탬프>_<영역>.sql`
예: `20260427000000_init.sql`, `20260427010000_rls.sql`, `20260427020000_cron.sql`

- `0001_init` (Phase 1 8개 테이블): orders, technicians, app_users, payments, audit_events, feature_flags, ip_allowlist, territories
- `0002_rls`: 6 role × 8 table 정책 (최소 24개)
- `0003_cron`: pg_cron 스케줄 (dispatch-preview 18:00 KST 등)
- `0004_hooks`: Custom Access Token Hook (app_metadata.role 심기)

본문 설계 근거: `02_IA/02_ERD.md`, `02_IA/04_PERMISSIONS.md`,
`05_TECH_STACK/03_BACKEND_SUPABASE.md`,
`05_TECH_STACK/06_EXTENSIBILITY_ARCHITECTURE.md §8`.

## 확장-축소 원칙 (헌법 제6조)

DB 스키마 변경은 반드시 **3단계**:
1. **확장**: 새 컬럼 추가, old 유지 (nullable 또는 기본값 제공)
2. **이중 쓰기**: old + new 동시 기록 · 애플리케이션 코드 전환
3. **축소**: old 제거 (다음 릴리스 주기)

`DROP COLUMN` 즉시 실행 금지. 배포 중 롤링 업데이트 시 old 참조 코드가 죽는다.
