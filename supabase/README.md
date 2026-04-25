# supabase/

Supabase 프로젝트 구성 디렉토리.

## 구조

```
supabase/
├── config.toml        # supabase init 으로 자동 생성 (로컬 개발용)
├── migrations/                # supabase db push 대상 (dev/prod 공용)
│   ├── 0001_init.sql           # 21 테이블 + 뷰 2 + 트리거 3 + app_settings seed 10키
│   ├── 0002_rls.sql            # RLS 활성 21 + 헬퍼 5 + 정책 55
│   └── 0004_hooks.sql          # Custom Access Token Hook (JWT claim 주입)
├── migrations_pending/        # CLI 미인식 보관소 (조건부 마이그레이션)
│   ├── 0003_cron.sql           # pg_cron · Pro 플랜 전환 후 migrations/ 로 이동
│   └── README.md
├── functions/                 # Edge Functions (Deno)
└── seed.sql                   # 개발용 최소 시드 (Step 4 확장 예정)
```

## 적용 절차 (은진님)

### 1단계 — dev 환경 (Free 플랜 · 0003 제외 3 파일)

```bash
cd D:\MOUNT1
supabase db push           # dev 는 링크 완료 상태 (project-ref nzphbeookxotdjzishqn)
# → 0001_init · 0002_rls · 0004_hooks 적용. 0003 은 migrations_pending/ 에 격리됨.
```

### 2단계 — 대시보드 Hook 활성화 (1회)

- Supabase Dashboard → Authentication → Hooks → "Custom Access Token"
- Function 선택: `public.custom_access_token_hook`

### 3단계 — prod (D-1 = 2026-05-02 · Pro 전환 후 4 파일 모두)

```bash
mv supabase/migrations_pending/0003_cron.sql supabase/migrations/0003_cron.sql
supabase link --project-ref rydmceypkospgzhvfpyx
supabase db push           # 4 파일 모두 적용
```

> dev 도 Pro 전환 시 동일 절차로 0003 활성화 가능. 자세한 내용은 `migrations_pending/README.md`.

## 마이그레이션 본문 요약

### 0001_init.sql
- **21 테이블** (ERD §3 전체): admin_users · technicians · customers · orders · coupang_order_staging · installations · photos · issues · cancellation_reports · happy_calls · call_logs · dispatches · payment_links · payments · technician_availabilities · notifications · audit_events · app_settings · technician_vacations · technician_recurring_offdays · technician_service_areas
- **뷰 2개**: `v_orders_dashboard` (관리자 Kanban), `v_technician_today` (기사 오늘건)
- **트리거 3종**: `set_updated_at` (8 테이블) · `audit_order_status_change` · `audit_lead_time_override`
- **app_settings seed**: `dispatch_weights` · `dispatch_gini_threshold` · `dispatch_gini_mode` · `weekend_operation_global` · `daily_report_recipients` · `photo_lifecycle_hot_days` · `payment_link_expiry_hours` · `unpaid_reminder_schedule` · `privacy_retention` · `pg_primary`

### 0002_rls.sql
- `alter table … enable row level security` × 21
- 헬퍼 함수 5개 (auth 스키마): `admin_role()` · `is_admin()` · `is_super_admin()` · `technician_id()` · `has_admin_role(text[])`
- 정책 55개 (04_PERMISSIONS §5.2~§5.10 + §2.1 매트릭스 보강)
- 기사용 뷰 `v_customer_for_technician` (PII 암호화 필드 제외)

### 0003_cron.sql ⚠️ 격리 중 (`migrations_pending/`)
- `create extension pg_cron` (Pro 플랜 이상)
- 현재 dev Free 플랜이라 `migrations_pending/` 으로 격리. prod Pro 전환 후 `migrations/` 로 이동하여 활성화.
- stub 함수 3종 (`generate_next_day_preview` · `calc_gini_and_notify` · `migrate_photo_tiers`)
- 스케줄 3건 — KST → UTC 환산 표현:
  - `dispatch-preview-next-day` : 매일 KST 00:00 (`0 15 * * *` UTC)
  - `weekly-gini-calc`          : 매주 KST 일 23:00 (`0 14 * * 0` UTC)
  - `photo-tier-migration`      : 매일 KST 04:00 (`0 19 * * *` UTC)

### 0004_hooks.sql
- `custom_access_token_hook(event jsonb) returns jsonb` — admin/technician 구분 후 JWT `app_metadata` 에 `user_type` · `admin_role` · `admin_user_id` · `technician_id` 주입
- `supabase_auth_admin` 전용 grant + RLS bypass 정책

## 마이그레이션 작성 가이드 (이후 Sprint)

파일명: `NNNN_<영역>.sql` 순번 (0005_*, 0006_* ...) 또는 `<타임스탬프>_<영역>.sql` (둘 다 CLI 허용).

신규 마이그레이션은 반드시 `02_IA/02_ERD.md` 를 먼저 업데이트 후 (헌법 제1조 Spec-First) 작성.

## 확장-축소 원칙 (헌법 제6조)

DB 스키마 변경은 반드시 **3단계**:
1. **확장**: 새 컬럼 추가, old 유지 (nullable 또는 기본값 제공)
2. **이중 쓰기**: old + new 동시 기록 · 애플리케이션 코드 전환
3. **축소**: old 제거 (다음 릴리스 주기)

`DROP COLUMN` 즉시 실행 금지. 배포 중 롤링 업데이트 시 old 참조 코드가 죽는다.

## 참고 원본 문서

- `D:\walltvprowiki\13_PROJECT_MANAGEMENT\MOUNTPARTNERS_APP\02_IA\02_ERD.md` (source_of_truth)
- `D:\walltvprowiki\13_PROJECT_MANAGEMENT\MOUNTPARTNERS_APP\02_IA\04_PERMISSIONS.md` (source_of_truth)
- `D:\walltvprowiki\13_PROJECT_MANAGEMENT\MOUNTPARTNERS_APP\05_TECH_STACK\03_BACKEND_SUPABASE.md §7.1`
- `D:\walltvprowiki\13_PROJECT_MANAGEMENT\MOUNTPARTNERS_APP\05_TECH_STACK\06_EXTENSIBILITY_ARCHITECTURE.md §8`
