# 은진님 액션 가이드 (HANDOFF)

> 코드는 자동 진행 중. 외부 서비스 가입·DB push·대시보드 설정 등 **사람이 직접 해야 할 일** 만 정리.
> Lead PM(Claude) 가 자율 루프 중 — 발견하는 새 액션은 본 문서에 계속 추가.

---

## 🔴 즉시 (이번 세션 중)

### 1. Supabase dev DB 마이그레이션 적용
```bash
cd D:\MOUNT1
git pull
supabase db push
```
- 적용 대상 (7개):
  - `0005_rpc.sql` (RPC 6종)
  - `0006_security_fix.sql` (auditor 권한 분리 + trigger search_path + view security_invoker)
  - `0007_security_round2.sql` (technicians cs/ops/auditor read 정책)
  - `0008_storage_rls.sql` (Storage 버킷 RLS — photos-hot · signatures · cls-reports-draft)
  - `0009_call_outcome_extend.sql` (call_outcome 5→7 + customer_postponed/cancelled)
  - `0010_realtime_publication.sql` (orders/installations/issues → supabase_realtime publication)
  - `0011_pii_decrypt.sql` (PII 복호화 helper + rpc_technician_get_customer_phone — Vault 키 필요, #21 참조)
- 결과: dev DB 에 RPC 함수 + 보안 정책 + Storage 정책 활성화
- 확인: 에러 없이 "Finished supabase db push" 메시지

### 2. types regenerate
```bash
pnpm --filter @mount/db db:types:dev
```
- 결과: `packages/db/src/types.generated.ts` 가 RPC 6종 포함하도록 갱신
- 확인: 파일 줄수 1683 → 약 1900+ (RPC 추가분)

### 3. Custom Access Token Hook 활성화 (Dashboard)
- URL: https://supabase.com/dashboard/project/nzphbeookxotdjzishqn/auth/hooks
- 메뉴: Authentication → Hooks → "Custom Access Token Hook"
- 설정: **활성화 ON** + Schema `public` + Function `custom_access_token_hook`
- Save

### 4. 첫 관리자 계정 발급 (Dashboard SQL Editor)
URL: https://supabase.com/dashboard/project/nzphbeookxotdjzishqn/sql/new

> ⚠️ **중요**: auth.users 직접 INSERT 만으로는 로그인 안 됨.
> `aud='authenticated'`, `auth.identities` 매핑, NOT NULL 컬럼 (confirmation_token 등) 빈 문자열 채움 모두 필요.
> 아래 단일 트랜잭션 블록은 그 모두를 한 번에 처리.

```sql
-- ============================================================================
-- super_admin 계정 발급 (트랜잭션 단일 블록)
-- ⚠️ 'STRONG_PASSWORD_HERE' 자리만 12자+ 강한 비밀번호로 교체 (대·소·숫자·특수문자)
-- ⚠️ 실행 후 비밀번호는 LastPass/1Password 등에 저장 (이후 평문 확인 불가)
-- ============================================================================

do $$
declare
  v_user_id uuid := gen_random_uuid();
  v_email text := 'super_admin_eunjin@internal.mountpartners.cloud';
  v_password text := 'STRONG_PASSWORD_HERE';
  v_display_name text := '은진';
begin
  -- (1) auth.users — 모든 NOT NULL/필수 컬럼 명시
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token,
    email_change_token_new, email_change, email_change_token_current,
    phone_change, phone_change_token, reauthentication_token
  ) values (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    v_email,
    crypt(v_password, gen_salt('bf')),
    now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    jsonb_build_object('display_name', v_display_name),
    now(), now(),
    '', '', '', '', '', '', '', ''
  );

  -- (2) auth.identities — password 로그인은 identities 매핑 필수
  insert into auth.identities (
    provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    v_user_id::text,
    v_user_id,
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', v_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    now(), now(), now()
  );

  -- (3) admin_users 매핑 (Hook 이 JWT app_metadata 채우는 lookup 대상)
  insert into admin_users (auth_user_id, display_name, email, role, status)
  values (v_user_id, v_display_name, v_email, 'super_admin', 'active');

  raise notice 'super_admin 계정 발급 완료: % (id=%)', v_email, v_user_id;
end $$;
```

확인:
```sql
select au.id, au.role, au.status, au.display_name,
       u.email, u.aud, u.email_confirmed_at is not null as confirmed,
       i.provider, (i.identity_data->>'email_verified')::bool as verified
  from admin_users au
  join auth.users u on u.id = au.auth_user_id
  left join auth.identities i on i.user_id = u.id and i.provider = 'email'
 where au.role = 'super_admin';
```
→ 1 행 + `aud='authenticated'` + `confirmed=true` + `provider='email'` + `verified=true` 모두 충족이어야 정상.

이후 admin 앱 `localhost:3001/login` 에서:
- 역할: 대표
- 아이디: `eunjin`
- 비밀번호: 설정한 STRONG_PASSWORD

로 로그인. (폼 내부에서 fake email `super_admin_{username}@internal.mountpartners.cloud` 로 변환)

---

#### 🔴 이미 NULL aud 로 만든 계정 복구 (위 블록 사용 안 했을 때)
```sql
update auth.users
   set aud = coalesce(aud, 'authenticated'),
       role = coalesce(role, 'authenticated'),
       instance_id = coalesce(instance_id, '00000000-0000-0000-0000-000000000000'),
       confirmation_token = coalesce(confirmation_token, ''),
       recovery_token = coalesce(recovery_token, ''),
       email_change_token_new = coalesce(email_change_token_new, ''),
       email_change = coalesce(email_change, ''),
       email_change_token_current = coalesce(email_change_token_current, ''),
       phone_change = coalesce(phone_change, ''),
       phone_change_token = coalesce(phone_change_token, ''),
       reauthentication_token = coalesce(reauthentication_token, '')
 where email = 'super_admin_eunjin@internal.mountpartners.cloud';

-- identities 누락 시 추가
insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select id::text, id,
       jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true, 'phone_verified', false),
       'email', now(), now(), now()
  from auth.users
 where email = 'super_admin_eunjin@internal.mountpartners.cloud'
   and id not in (select user_id from auth.identities where provider = 'email');
```

---

## 🟠 D-Day 전 (2026-05-02 까지)

### 5. Sentry 가입 + DSN 매핑 정확화
- https://sentry.io/projects/ → 본인 프로젝트 2개 (mount-driver / mount-admin) 클릭
- 각각 Settings → Client Keys (DSN) 에서 DSN 끝자리 4자리 확인
- 현재 .env.local 에 추측 매핑된 2 DSN 이 정확히 driver/admin 매칭되는지 검증
- 다르면 .env.local 의 두 줄 swap

### 6. Supabase Storage 버킷 생성 (사진 업로드 R5 활성화 — 즉시 권장)
- https://supabase.com/dashboard/project/nzphbeookxotdjzishqn/storage/buckets
- "New bucket" → 다음 3개 모두 생성:
  - `photos-hot` (public OFF · RLS 적용 예정)
  - `signatures` (public OFF)
  - `cls-reports-draft` (public OFF · super_admin only)
- 각 버킷 → Configuration → "RLS policies" 활성화

### 7. Cloudflare R2 버킷 (Phase 2 lifecycle)
- https://dash.cloudflare.com/?to=/:account/r2
- "Create bucket" → 3개:
  - `mount-photos-hot` (Hot tier · 0~30일)
  - `mount-photos-warm` (Warm tier · 30일~1년)
  - `mount-photos-cold` (Cold tier · 1년+)
- API Token 발급 → `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_ACCOUNT_ID`
- .env.local 양쪽에 추가

### 8. 도메인 + Vercel
- `mountpartners.cloud` 도메인 소유 확인
- Cloudflare DNS 설정:
  - `app.mountpartners.cloud` → Vercel mount-driver
  - `admin.mountpartners.cloud` → Vercel mount-admin
  - `photos.mountpartners.cloud` → R2 (Phase 2)
- Vercel Dashboard → Project 2개:
  - `mount-driver` → GitHub `eunjinemo-coder/mount1` 연동, Root Directory `apps/driver`
  - `mount-admin` → 동일, Root `apps/admin`
- Environment Variables 에 .env.local 의 전체 키 입력 (Production)

### 9. Solapi (SMS / 카카오 알림톡)
- https://solapi.com 가입
- 발신번호 인증 (1577-XXXX 또는 발신용 010 번호)
- 카카오 비즈니스 채널 등록 + 알림톡 템플릿 9~10종 승인 신청 (1~3일)
  - T01 (배차 확정) · T02 (사전 통화 안내) · T03 (출발 알림) · T04 (결제 링크)
  - T05A/B (결제 완료) · T06 (정산) · T07 (잠금 해제 안내)
  - T10 (관리자 계정 발급 카드)
- API Key/Secret/PFID 발급 → .env.local 추가

### 10. Kakao Developers
- https://developers.kakao.com 앱 2개 (Map · 알림톡)
- Map 앱: Web 플랫폼 도메인 등록 (`https://app.mountpartners.cloud`)
- API Key 발급 → `NEXT_PUBLIC_KAKAO_MAP_KEY` / `KAKAO_REST_API_KEY`

### 11. PortOne (PG 결제)
- https://portone.io 가맹점 가입 + 이노페이 온보딩 (1~2일)
- Store ID / API Secret / Webhook Secret 발급
- .env.local + Webhook URL 등록 (Phase 2 결제 화면 작업 시)

### 12. Sentry Auth Token (선택, source map 업로드용)
- 현재는 없어도 빌드 OK (소스맵만 업로드 안 됨)
- 필요 시: User settings → User Auth Tokens → Create New
- Scope 4종 체크: `project:releases` · `project:read` · `project:write` · `org:read`

### 13. Supabase Pro 플랜 전환 (prod 만, D-1 권장)
- 현재 dev/prod 모두 Free
- prod 만 Pro 전환 ($25/월) → pg_cron · PITR · 백업 활성화
- 전환 후:
  ```bash
  mv supabase/migrations_pending/0003_cron.sql supabase/migrations/
  supabase link --project-ref rydmceypkospgzhvfpyx
  supabase db push
  ```

---

## 🟡 R5 작업 시점 (다음 주)

### 14. PWA 아이콘 에셋 (TD-008)
- `apps/driver/public/icons/{192,512,512-maskable,180}.png`
- partner-landing `public/logo-mark.png` 기반 자동 생성 또는 수동 export
- manifest.json 이 이미 참조 중

### 15. partner-landing 포트 변경 (driver dev 충돌)
- partner-landing 의 dev 포트를 3100 같은 곳으로 변경
- 또는 driver 의 dev 포트를 3000 그대로 유지하되 partner-landing 을 안 띄우도록 워크플로우 조정

### 16. 의존성 취약점 모니터링
- `pnpm audit` 매주 1회 확인
- 현재 transitive moderate 2건 (postcss, uuid) — Sentry/Next 패치 릴리즈 대기

### 21. Supabase Vault — PII 암호화 키 등록 (필수, 0011 마이그레이션 사전 조건)
- URL: https://supabase.com/dashboard/project/nzphbeookxotdjzishqn/settings/vault
- 메뉴: Project Settings → Vault → "New secret"
- 입력:
  - **Name**: `pii_key`
  - **Value**: 32바이트 강한 base64 키 — 터미널에서 1회 생성:
    ```bash
    openssl rand -base64 32
    # 또는 PowerShell: [Convert]::ToBase64String((New-Object byte[] 32 | ForEach-Object { Get-Random -Maximum 256 }))
    ```
  - 결과 예시: `Yn4f3K2L9aQ8Wp1mZ5xV6tR0sH3jB7eU+8oI4nC2dGk=`
  - **⚠️ LastPass / 1Password 등에 저장** — 키를 잃으면 모든 PII 복호화 불가
- prod 등록도 동일 (단, dev/prod 동일 키여야 데이터 호환 — 환경별 분리 운영 시 export/import 시 별도 처리)
- 검증:
  ```sql
  -- Vault 등록 확인
  select name from vault.decrypted_secrets where name = 'pii_key';
  -- 함수 호출 (다른 SECURITY DEFINER 함수가 호출할 때만 작동)
  select length(encrypt_pii('test'));   -- 60+ bytea bytes 나오면 성공
  ```

### 17. dev DB 도 Pro 전환 검토
- 결정: Free 유지 vs Pro ($25/월 추가) — pg_cron stub 작동 위해 Pro 권장
- Pro 전환 시 dev 에도 0003_cron.sql 적용 가능

---

## 🟢 운영 시작 후 (D+1 이후)

### 18. 운영 모니터링
- Sentry: https://sentry.io/issues/ — 일일 1회 확인
- PostHog: https://us.posthog.com/project/{id}/insights — 주 1회 확인
- Supabase: https://supabase.com/dashboard/project/{id}/database/usage — 주 1회

### 19. 백업 (Pro 자동 + 수동 보강)
- Pro 자동 백업 7일 보관 (Supabase 기본)
- 추가: 매주 일요일 02:00 `supabase db dump` → R2 보관

### 20. 협력기사 계정 발급
- 본사 (은진님) 가 admin 앱 `/admin/accounts/new` (R8 이후) 에서 발급
- 또는 아래 SQL Editor 블록 사용 (super_admin 패턴과 동일 — aud + identities + NOT NULL 컬럼 모두 포함)

```sql
-- ============================================================================
-- 협력기사(technician) 계정 발급
-- ⚠️ 4 변수만 교체: v_username, v_password, v_display_name, v_phone
-- ⚠️ technicians 테이블에 사전에 row 가 있어야 함 (admin 이 R8 화면에서 등록)
--    또는 아래 (4) 블록의 주석을 풀어 SQL 으로 직접 등록
-- ============================================================================

do $$
declare
  v_user_id uuid := gen_random_uuid();
  v_username text := 'kim_minsu';                  -- ← 영문/숫자 32자 이내, 고유
  v_password text := 'STRONG_PASSWORD_HERE';       -- ← 12자+ 강한 비밀번호
  v_display_name text := '김민수';                  -- ← 기사 이름
  v_phone text := '01012345678';                   -- ← E.164 (하이픈 없이) — 알림톡 발송용
  v_email text := 'technician_' || v_username || '@internal.mountpartners.cloud';
  v_tech_id uuid;
begin
  -- (1) auth.users
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token,
    email_change_token_new, email_change, email_change_token_current,
    phone_change, phone_change_token, reauthentication_token
  ) values (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    v_email, crypt(v_password, gen_salt('bf')),
    now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    jsonb_build_object('display_name', v_display_name),
    now(), now(),
    '', '', '', '', '', '', '', ''
  );

  -- (2) auth.identities
  insert into auth.identities (
    provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    v_user_id::text, v_user_id,
    jsonb_build_object(
      'sub', v_user_id::text, 'email', v_email,
      'email_verified', true, 'phone_verified', false
    ),
    'email', now(), now(), now()
  );

  -- (3) technicians 매핑 (사전 등록된 row 와 연결)
  update technicians
     set auth_user_id = v_user_id,
         status = 'active'
   where display_name = v_display_name      -- 사전 등록 시 동일한 이름이어야 매칭
     and auth_user_id is null
   returning id into v_tech_id;

  if v_tech_id is null then
    raise exception '사전 등록된 technicians row 없음 — admin /technicians 에서 % 먼저 등록 후 재실행', v_display_name;
  end if;

  -- (4) 사전 등록 없이 한 번에 만들고 싶으면 위 (3) 대신 아래 사용 (주석 해제)
  -- insert into technicians (auth_user_id, display_name, phone_e164, status, grade, daily_capacity)
  -- values (v_user_id, v_display_name, v_phone, 'active', 'C', 5)
  -- returning id into v_tech_id;

  raise notice 'technician 발급 완료: % (auth_user_id=%, technician_id=%)',
    v_username, v_user_id, v_tech_id;
end $$;
```

확인:
```sql
select t.id as technician_id, t.display_name, t.status, t.grade,
       u.email, u.aud, i.provider
  from technicians t
  join auth.users u on u.id = t.auth_user_id
  left join auth.identities i on i.user_id = u.id and i.provider = 'email'
 where t.display_name = '김민수';
```

기사 로그인 (`localhost:3000/login`):
- 아이디: `kim_minsu`
- 비밀번호: 설정한 STRONG_PASSWORD

---

## 📊 현재 상태 (2026-04-26)

```
git: main @ 577b011 (모든 push 완료)
검증: typecheck 6/6 ✓ · lint 6/6 ✓ · build 2/2 ✓
라우트: driver 13 + admin 9 = 22 라우트 빌드
마이그레이션: 0001/0002/0004 dev 적용 ✓ · 0005/0006 dev push 대기
.env.local: 4 키 활성 (Sentry DSN×2 + PostHog×2)
```

## 🤖 자동화 진행 중 (사용자 개입 불필요)

- Lead PM(Claude) 권한 위임 모드
- 검증 → 개선 → 검증 루프 자동 진행
- 4 에이전트 (code-reviewer · security-reviewer · general-purpose · e2e-runner) 주기적 dispatch
- 새 P0/P1 발견 시 즉시 자동 수정 + commit + push
- 본 HANDOFF 문서에 외부 연동 필요한 사항 추가 시 알림

---

_업데이트: 2026-04-26 03:XX KST · Lead PM (Claude) 자동 작성_
