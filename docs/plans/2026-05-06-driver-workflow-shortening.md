# Driver 워크플로 단축 v2 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use the appropriate execution skill (`executing-plans` or `subagent-driven-development`) to implement this plan.

**Goal:** driver 4-step transition을 [완료] 1개로 단축하고 주문 상세를 2탭(개요/이슈)으로 재구조화한다 — UX는 단순화, 본사 관측성은 RLS·alert로 보존.

**Architecture:** Next.js 16 monorepo(apps/driver, apps/admin) + Supabase Postgres(RLS + RPC) + shadcn/ui. driver의 `[완료]` 클릭은 신규 RPC `complete_install_atomic`로 atomic 처리(status + 메모 + 동의 + 사진 검증 + 본사 alert). 예약시각 편집·이슈 작성은 RLS 정책으로 직접 UPDATE/INSERT. 카카오 네비는 customer.address_lat/lng 좌표로 URL scheme 호출.

**Tech Stack:** TypeScript / Next.js 16 / React 19 / Tailwind v4 / shadcn/ui / lucide-react / Supabase / Zod / pnpm + Turbo monorepo.

**Assumptions:**
- 진행 중 주문(en_route/on_site/in_progress) 0건인 시점에 배포한다 — 진행 중 데이터 있으면 driver UI에서 [완료] 안 보여 차단됨. **Task 1.0이 pre-deploy 검증을 강제한다.**
- en_route/on_site/in_progress status enum 값은 **제거하지 않는다** — 쿠팡 동기화·과거 이력에 남기 위해. 단 신규 주문은 거치지 않음.
- 본사 admin 알림 채널은 1차로 DB log 테이블에 trigger insert만 — 실제 push/slack 통합은 R-next+1.
- 카카오 디벨로퍼스 API key 발급 가능(JS SDK + REST API 무료 한도 내).
- 테스트는 manual verification (typecheck/lint/build/dev server walkthrough). E2E·unit 인프라는 별도 슬라이스 또는 추후 도입.
- Tier 1(order-card.tsx 시각적 개선)은 별도 wireframe(`.lazyweb/design-improve/...preview.html`)으로 사용자 승인 완료된 디자인을 따른다.
- JWT claim 경로: `auth.jwt() -> 'app_metadata' ->> 'user_type'` (admin), `'technician_id'` (기사). RLS helper는 `public.technician_id()`, `public.is_admin()`. trigger/policy에서 직접 `request.jwt.claims->>'user_role'` 같은 비표준 경로 사용 금지.
- 기사 권한 변경(`scheduled_installation_at`)은 **RPC를 통해서만 처리** — 광역 `revoke update on orders from authenticated` 같은 GRANT 변경은 admin 영향 위험으로 회피.
- option_selected, conversion_from_no_drill는 0001_init에 이미 존재하는 컬럼 (Slice 1에서 별도 추가 X).
- 환경: Windows PowerShell — bash 명령은 Bash 도구로 명시 호출 또는 PowerShell 등가물 사용.

**관련 문서:**
- 도메인 정의: [`CONTEXT.md`](../../CONTEXT.md)
- 결정 근거: [`docs/adr/0001-status-machine-shortened.md`](../adr/0001-status-machine-shortened.md), [`docs/adr/0002-schedule-edit-policy.md`](../adr/0002-schedule-edit-policy.md)
- 와이어: `D:\walltvprowiki\13_PROJECT_MANAGEMENT\MOUNTPARTNERS_APP\.lazyweb\design-improve\driver-today-2026-05-05\sitemap-wireframe.html`

---

## Slice 1 — Schema + RLS + RPC 기반

> 다른 모든 슬라이스의 dependency. 먼저 끝내야 한다.

### Task 1.0: Pre-deploy 검증 — in-flight 주문 0건 확인

**Files:** (read-only)

**Does NOT cover:** 실제 데이터 정리 — 진행 중 주문 발견 시 본사가 admin에서 수동 처리하거나 배포 시점 조정. 본 task는 차단 게이트만.

**Step 1: SQL 실행**
Run: `psql "$DATABASE_URL" -c "select id, status, assigned_technician_id, scheduled_installation_at from orders where status in ('en_route','on_site','in_progress') order by scheduled_installation_at;"`
Expected: 0 rows. 1건 이상이면 배포 중단 → 본사와 협의.

**Step 2: 배포 직전 재실행**
- Slice 1.1 마이그레이션 적용 직전 한 번 더 동일 쿼리 실행. 0건 확인 후에만 진행.

---

### Task 1.1: 마이그레이션 0017 — orders.customer_consent_confirmed 컬럼 추가

**Files:**
- Create: `supabase/migrations/0017_v2_workflow_schema.sql`

**Does NOT cover:** /complete 화면에서 false로 저장되는 경우 본사 alert 발송 로직(이건 Slice 4의 RPC 안에서 처리). 단순히 컬럼만 추가.

**Step 1: 마이그레이션 작성**
```sql
alter table orders add column customer_consent_confirmed boolean not null default false;
comment on column orders.customer_consent_confirmed is
  'driver /complete 화면에서 기사 self-report — 신분증·결제 안내 완료. 분쟁 시 증거.';
```

**Step 2: Verify**
Run: `cd /c/dev/MOUNT1 && supabase db reset --debug`
Expected: 0017 적용 + 0001~0016 모두 재실행, 에러 없음.

**Step 3: Commit**
```bash
git add supabase/migrations/0017_v2_workflow_schema.sql
git commit -m "feat(db): add orders.customer_consent_confirmed for v2 self-report"
```

---

### Task 1.2: 0017에 issues.admin_response_text + admin_response_at 컬럼 추가

**Files:**
- Modify: `supabase/migrations/0017_v2_workflow_schema.sql` (같은 파일 append)

**Step 1: SQL append**
```sql
alter table issues add column admin_response_text text;
alter table issues add column admin_response_at timestamptz;
alter table issues add column admin_responder_id uuid references admin_users(id);
comment on column issues.admin_response_text is '본사 1:1 응답. driver 이슈 이력 emerald 라인으로 표시.';
```

**Step 2: Verify**
Run: `supabase db reset --debug`
Expected: 에러 없음.

**Step 3: Commit**
```bash
git commit -am "feat(db): add issues admin_response columns"
```

---

### Task 1.3: 0017에 photos_insert RLS 완화 — assigned 추가

**Files:**
- Modify: `supabase/migrations/0017_v2_workflow_schema.sql`

**Does NOT cover:** receipts/closed status 등 완료 후 사진 추가 — 그건 별도 정책. 본 변경은 시공 시작 전(assigned)에서도 사진 INSERT 가능하게 함.

**Step 1: SQL append**
```sql
drop policy if exists photos_insert_technician on photos;
create policy photos_insert_technician on photos for insert
  with check (
    technician_id = public.technician_id()
    and exists (
      select 1 from orders o
      where o.id = photos.order_id
        and o.assigned_technician_id = public.technician_id()
        and o.status in ('assigned','en_route','on_site','in_progress')
    )
  );
```

**Step 2: Verify (SQL)**
Run: `psql -c "set role authenticated; insert into photos(order_id, technician_id, slot, supabase_path) values (...);"` (assigned 상태 주문으로)
Expected: insert 성공 (이전엔 RLS 거부).

**Step 3: Commit**
```bash
git commit -am "feat(db): allow photos insert in assigned status (v2 single-jump)"
```

---

### Task 1.4: 0017에 update_schedule_by_technician RPC 추가 (1h 윈도우)

**Files:**
- Modify: `supabase/migrations/0017_v2_workflow_schema.sql`

**Does NOT cover:** 시작 1h 이내 변경 — RPC가 거부. 본사 카카오톡 채널로 fallback. 충돌 검사(같은 시간 다른 시공) — 차단 X, UI에서 경고만. RLS `orders_update`는 admin만으로 그대로 유지(광역 `revoke` 위험 회피).

**Step 1: SQL append (RPC 방식 — RLS 변경 없음)**
```sql
create or replace function update_schedule_by_technician(
  p_order_id uuid,
  p_new_scheduled_at timestamptz
) returns jsonb
language plpgsql
security definer
as $$
declare
  v_tech uuid := public.technician_id();
  v_order orders;
begin
  if v_tech is null then raise exception 'unauthorized'; end if;
  select * into v_order from orders where id = p_order_id;
  if not found then raise exception 'order_not_found'; end if;
  if v_order.assigned_technician_id <> v_tech then raise exception 'forbidden'; end if;
  if v_order.status <> 'assigned' then raise exception 'invalid_status: %', v_order.status; end if;
  if p_new_scheduled_at - now() < interval '1 hour' then
    raise exception 'window_closed: 시작 1시간 이내 변경 불가, 본사 채널 이용';
  end if;
  -- 새 시각 자체도 미래여야
  if p_new_scheduled_at <= now() then raise exception 'past_time'; end if;

  update orders set
    scheduled_installation_at = p_new_scheduled_at
  where id = p_order_id;

  return jsonb_build_object('ok', true, 'new_at', p_new_scheduled_at);
end;
$$;

grant execute on function update_schedule_by_technician to authenticated;
revoke execute on function update_schedule_by_technician from anon;
```

**Step 2: Verify (SQL — admin 영향 회귀 검증 포함)**
Run (회귀):
```sql
-- 1. admin이 다른 컬럼 변경 가능 (회귀 X 확인)
set role authenticator; set local request.jwt.claims to '{"app_metadata":{"user_type":"admin","admin_role":"super_admin"}}'::text;
update orders set tv_brand = 'TEST_BRAND' where id = '<test_order>'; -- 성공해야
-- 2. 기사가 RPC로 2시간 후 주문 변경 → 성공
select update_schedule_by_technician('<test_order>', now() + interval '2 hours'); -- ok
-- 3. 기사가 30분 후 주문 변경 → window_closed 거부
select update_schedule_by_technician('<test_order>', now() + interval '30 minutes'); -- exception
```
Expected: 1) 성공, 2) ok=true, 3) `window_closed` 예외.

**Step 3: Commit**
```bash
git commit -am "feat(db): update_schedule_by_technician RPC with 1h window"
```

---

### Task 1.5: 0017에 issues_insert_technician + issues_update_admin_response RLS

**Files:**
- Modify: `supabase/migrations/0017_v2_workflow_schema.sql`

**Step 1: SQL append**
```sql
create policy issues_insert_technician on issues for insert
  with check (
    technician_id = public.technician_id()
    and exists (
      select 1 from orders o
      where o.id = issues.order_id
        and o.assigned_technician_id = public.technician_id()
    )
  );

create policy issues_select_technician on issues for select
  using (
    exists (
      select 1 from orders o
      where o.id = issues.order_id
        and o.assigned_technician_id = public.technician_id()
    )
  );

create policy issues_update_admin_response on issues for update
  using (public.is_admin())
  with check (public.is_admin());
```

**Step 2: Verify (SQL)**
Run: 기사 권한으로 자기 주문에 issue insert → 성공. 다른 기사 주문 insert 시도 → 거부.

**Step 3: Commit**
```bash
git commit -am "feat(db): RLS for issues — technician insert/select, admin response update"
```

---

### Task 1.6: 0017에 schedule change alert log 테이블 + trigger

**Files:**
- Modify: `supabase/migrations/0017_v2_workflow_schema.sql`

**Step 1: SQL append**
```sql
create table admin_alerts (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  order_id uuid references orders(id) on delete cascade,
  technician_id uuid references technicians(id),
  payload jsonb,
  created_at timestamptz default now(),
  acknowledged_at timestamptz
);
create index idx_admin_alerts_unack on admin_alerts(created_at desc) where acknowledged_at is null;

-- 주의: trigger의 WHEN 조건은 JWT claim에 의존하지 말 것 — Supabase는 'app_metadata.user_type'·'app_metadata.technician_id'에 저장.
-- 가장 신뢰 가능한 신호는 public.technician_id() 결과 (null이면 admin 또는 시스템).
-- 즉 기사 변경에서만 발생. update_schedule_by_technician RPC가 security definer라도 calling user의 JWT는 그대로 유지됨.
create or replace function notify_schedule_change() returns trigger as $$
begin
  if old.scheduled_installation_at is distinct from new.scheduled_installation_at
     and public.technician_id() is not null then  -- 기사 변경만 alert
    insert into admin_alerts(type, order_id, technician_id, payload)
    values (
      'schedule_changed_by_technician',
      new.id,
      new.assigned_technician_id,
      jsonb_build_object('old', old.scheduled_installation_at, 'new', new.scheduled_installation_at)
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_orders_schedule_change
  after update on orders
  for each row
  execute function notify_schedule_change();
```

**Step 2: Verify (SQL)**
Run:
```sql
-- 기사 RPC로 변경 → alert 1건
select update_schedule_by_technician('<test_order>', now() + interval '2 hours');
select * from admin_alerts where type='schedule_changed_by_technician' order by created_at desc limit 1; -- row 존재
-- admin이 같은 컬럼 변경 → alert 발생 X (technician_id() null)
update orders set scheduled_installation_at = now() + interval '3 hours' where id = '<test_order>';
-- 직전 admin_alerts count 변화 X 확인
```
Expected: 기사 변경 = alert 1건 / admin 변경 = alert X.

**Step 3: Commit**
```bash
git commit -am "feat(db): admin_alerts table + schedule change trigger"
```

---

### Task 1.7: RPC complete_install_atomic 작성

**Files:**
- Modify: `supabase/migrations/0017_v2_workflow_schema.sql`

**Does NOT cover:**
- PRE 2 + POST 3 사진 미충족 차단 — 사진 부족도 허용(질문 6 옵션 B). 단 photos_count_pre/post를 결과 jsonb에 담아 본사가 검수에서 인지 가능.
- **Status가 `assigned`가 아닌 경우 차단**: en_route/on_site/in_progress 상태에서 RPC 호출 시 `invalid_status` 예외. 이는 Task 1.0의 pre-deploy 검증으로 0건 가정. 만약 진행 중 주문이 발생할 가능성이 있으면 본 RPC도 그 status를 허용 분기 추가 필요(현재 plan은 단일 점프만 가정).
- 컬럼 검증: option_selected, conversion_from_no_drill는 0001_init.sql에 이미 존재 — 별도 ADD COLUMN 불필요.

**Step 1: SQL append**
```sql
create or replace function complete_install_atomic(
  p_order_id uuid,
  p_option_selected text,        -- 'C_no_drill' | 'B_drill' (전환 시)
  p_conversion boolean,           -- 타공 전환 여부
  p_consent_confirmed boolean,    -- /complete 체크박스
  p_memo text,
  p_photo_pre_count int,
  p_photo_post_count int
) returns jsonb
language plpgsql
security definer
as $$
declare
  v_tech uuid := public.technician_id();
  v_order orders;
  v_new_status text;
  v_alert_payload jsonb;
begin
  select * into v_order from orders where id = p_order_id;
  if not found then raise exception 'order_not_found'; end if;
  if v_order.assigned_technician_id <> v_tech then raise exception 'forbidden'; end if;
  if v_order.status not in ('assigned') then raise exception 'invalid_status: %', v_order.status; end if;

  v_new_status := case
    when p_conversion then 'drill_converted_completed'
    else 'no_drill_completed'
  end;

  update orders set
    status = v_new_status,
    status_changed_at = now(),
    customer_consent_confirmed = p_consent_confirmed,
    special_notes = coalesce(special_notes,'') || case when p_memo is null or p_memo='' then '' else E'\n[v2 complete memo] ' || p_memo end,
    conversion_from_no_drill = p_conversion,
    option_selected = p_option_selected
  where id = p_order_id;

  -- 본사 alert (사진 부족 + 동의 false 시)
  if p_photo_pre_count < 2 or p_photo_post_count < 3 or not p_consent_confirmed then
    v_alert_payload := jsonb_build_object(
      'pre_count', p_photo_pre_count,
      'post_count', p_photo_post_count,
      'consent', p_consent_confirmed,
      'memo', p_memo
    );
    insert into admin_alerts(type, order_id, technician_id, payload)
    values ('completion_with_warnings', p_order_id, v_tech, v_alert_payload);
  end if;

  return jsonb_build_object('ok', true, 'new_status', v_new_status);
end;
$$;

grant execute on function complete_install_atomic to authenticated;
```

**Step 2: Verify (SQL)**
Run: assigned 주문 → `select complete_install_atomic(...)` 호출 → status 변경 + alert insert.

**Step 3: Commit**
```bash
git commit -am "feat(db): complete_install_atomic RPC for v2 single-jump"
```

---

### Task 1.8: types 동기화

**Files:**
- Modify: `packages/types/src/order.ts`
- Generate: `packages/db/src/types.ts` (auto)

**Step 1: 마이그레이션 적용 + 타입 재생성**
Run: `pnpm db:types`
Expected: 새 컬럼들이 generated types에 반영.

**Step 2: order.ts 수동 동기화**
Modify `packages/types/src/order.ts` OrderSchema에 `customer_consent_confirmed: z.boolean()` 추가.

**Step 3: typecheck**
Run: `pnpm typecheck`
Expected: 통과.

**Step 4: Commit**
```bash
git commit -am "chore(types): sync schema for v2 columns"
```

---

## Slice 2 — Driver Tier 1 시각 개선 (order-card.tsx 한 파일)

> 다른 슬라이스와 독립. 먼저 머지해도 무방. 사용자 가시 효과 즉시.
> **주의**: emerald stripe(`no_drill_completed`/`drill_converted_completed`)는 Slice 4 RPC가 도입되기 전까지 데이터에 거의 나타나지 않음(과거 완료 주문에만). 진행 중 amber tone은 Task 1.0 가정상 신규 데이터에서도 등장 X — 그러나 Slice 2 코드는 statusKey 매핑만 처리하므로 여전히 안전.

### Task 2.1: order-card.tsx — 시간 폰트 + 좌측 stripe + 진행중 톤

**Files:**
- Modify: `apps/driver/app/(driver)/today/order-card.tsx`

**Step 1: 변경 사항**
- `time` 표시: `text-lg` → `text-xl`
- 카드에 status별 stripe + bg tone 추가 (CSS class):
  - `assigned` / `en_route` → `border-l-4 border-l-slate-300`
  - `on_site` / `in_progress` → `border-l-4 border-l-amber-500 bg-amber-50/30`
  - `no_drill_completed` / `drill_converted_completed` → `border-l-4 border-l-emerald-500`

**Step 2: 시간 컨텍스트 추가**
- 시간 옆에 `Intl.RelativeTimeFormat('ko', {numeric:'auto'})` 결과 표시:
  - 30분 후, 2시간째 진행, 4시간 전 등.
- 헬퍼 `formatRelativeTime(scheduled, status)` 함수 추가.

**Step 3: Verify (manual)**
Run: `pnpm dev:driver` + 브라우저에서 `/today` 진입 (테스트 데이터 필요).
Expected: 와이어와 일치 — 진행중 카드 amber tone, 완료 카드 emerald stripe, 시간이 18→20px, 상대시각 표시.

**Step 4: Commit**
```bash
git commit -am "feat(driver): order-card v2 visual hierarchy (Tier 1)"
```

---

## Slice 3 — Driver order detail v2 재구조 (4탭 → 2탭)

> Slice 1 완료 후 진행 (RLS 의존).

### Task 3.1: 4탭 → 2탭 (사진/통화 탭 컴포넌트 제거)

**Files:**
- Modify: `apps/driver/app/(driver)/order/[orderId]/page.tsx`

**Step 1: 변경 사항**
- `TABS` 배열에서 `photos`, `calls` 제거 → `[overview, issues]` 2개만
- 활성 탭 분기 단순화 — `activeTab === 'photos' | 'calls'` 분기 삭제
- 사진/통화 탭에 사용된 fetch(`photosResult`, `callLogsResult`) 그대로 유지 (개요 진행현황에 사용)

**Step 2: Verify (manual)**
Run: `pnpm dev:driver` + 브라우저에서 `/order/{id}?tab=photos` 진입 → 개요 탭으로 redirect 또는 fallback (URL 무효 처리).
Expected: 탭이 2개만 보임.

**Step 3: Commit**
```bash
git commit -am "feat(driver): order detail tabs 4→2 (overview/issues only)"
```

---

### Task 3.2: 개요 — 고객 카드에 🧭 / 📞 아이콘 추가

**Files:**
- Modify: `apps/driver/app/(driver)/order/[orderId]/page.tsx`

**Does NOT cover:** address_lat/lng가 null인 경우 — Task 3.3에서 fallback 처리. 본 task는 좌표 있다 가정한 nominal path.

**Step 1: 변경 사항**
- 고객 fetch 쿼리에 `address_lat, address_lng` 추가 (`v_customer_for_technician` view 이미 노출).
- 주소 row 우측: `<a href="kakaonavi://navigate?dest_x={lng}&dest_y={lat}&dest_name={encodeURIComponent(주소)}">🧭</a>` (lucide Navigation 아이콘)
- 전화 row 우측: `<Link href="/order/${orderId}/pre-call">📞</Link>` (lucide Phone 아이콘)

**Step 2: Verify (manual)**
Run: dev server + 모바일 디바이스/시뮬레이터에서 🧭 탭 → 카카오 네비 앱 호출 / 📞 탭 → /pre-call 진입.
Expected: 두 아이콘 동작.

**Step 3: Commit**
```bash
git commit -am "feat(driver): customer card kakaonavi/pre-call inline icons"
```

---

### Task 3.3: 카카오 네비 좌표 null fallback (kakaomap 검색)

**Files:**
- Modify: `apps/driver/app/(driver)/order/[orderId]/page.tsx`

**Does NOT cover:** 카카오맵·카카오 네비 둘 다 미설치 환경 — 시스템 fallback (브라우저 store link)은 향후. 일단 URL scheme만 사용.

**Step 1: 분기 로직**
```tsx
const naviHref = customer?.address_lat && customer?.address_lng
  ? `kakaonavi://navigate?dest_x=${customer.address_lng}&dest_y=${customer.address_lat}&dest_name=${encodeURIComponent(addressFull)}`
  : `kakaomap://search?q=${encodeURIComponent(addressFull)}`;
```

**Step 2: Verify (manual)**
Run: lat/lng가 null인 테스트 주문 만들고 🧭 탭 → 카카오맵 검색 화면 진입.

**Step 3: Commit**
```bash
git commit -am "feat(driver): kakaomap fallback when coords are null"
```

---

### Task 3.4: 진행현황 자동 채움 — 사전통화 ✓ outcome 무관으로 변경

**Files:**
- Modify: `apps/driver/app/(driver)/order/[orderId]/page.tsx`

**Does NOT cover:** outcome=`customer_cancelled`나 `customer_postponed` 같은 명시적 부정 outcome도 ✓ 처리 — 사용자 결정에 따름 (사전통화 = 시도 행위). 이 케이스는 본사가 outcome 데이터로 별도 검수.

**Step 1: 조건 변경**
기존:
```ts
const preCallDone = callLogs.some(
  (c) => c.type === 'pre_arrival_30min' &&
    ['answered', 'manual_marked_done'].includes(c.call_outcome ?? '')
);
```
신규:
```ts
const preCallDone = callLogs.some((c) => c.type === 'pre_arrival_30min');
```

**Step 2: Verify (manual)**
Run: pre-call 페이지에서 outcome=`no_answer` 저장 → /order/{id} 개요 → 사전통화 ✓ 표시.

**Step 3: Commit**
```bash
git commit -am "feat(driver): pre-call ✓ trigger on any outcome (per CONTEXT.md)"
```

---

### Task 3.5: 개요 메인 CTA → [완료] 1개 + footer danger 취소 링크

**Files:**
- Modify: `apps/driver/app/(driver)/order/[orderId]/page.tsx`

**Does NOT cover:** [완료] 클릭 후 status 변경 — 사진 업로드 흐름은 Slice 4에서. 본 task는 단순 라우팅만.

**Step 1: ActionButtons 단순화**
- status === 'assigned' → `[완료]` 버튼 1개 (href=`/order/${id}/photos`)
- status === ('no_drill_completed'|'drill_converted_completed') → 액션 없음 메시지
- en_route/on_site/in_progress 분기 코드 삭제(deprecated, 마이그레이션 후 발생 안 함)

**Step 2: Footer danger zone**
- ActionButtons 아래 `<Separator/>` + 작은 텍스트 링크: "⚠ 시공 취소 보고" (color red, font-size 11px) → `/order/${id}/cancel`

**Step 3: Verify (manual)**
Run: dev + assigned 주문 → 개요에서 [완료] 1개 + footer 취소 링크 보임.

**Step 4: Commit**
```bash
git commit -am "feat(driver): single [완료] CTA + footer cancel link"
```

---

### Task 3.6: 사진 / 통화 sub-tab 컴포넌트 파일 정리

**Files:**
- Delete: 사진 / 통화 탭 전용 inline JSX(Task 3.1에서 함께 제거됨) — 별도 컴포넌트 파일 없으므로 추가 작업 없음. 확인만.

**Step 1: Verify**
Run: `grep -r "tab=photos\|tab=calls" /c/dev/MOUNT1/apps/driver/app/`
Expected: 매치 없음.

**Step 2: 매치 발견 시 remediation**
- 같은 task 내에서 잔여 참조 제거 → 다시 grep 실행 → 0건 확인.
- type 검증: `pnpm typecheck`

**Step 3: Commit**
```bash
git commit -am "chore(driver): clean up stale photos/calls tab references"
```

---

### Task 3.7: /start 페이지 삭제

**Files:**
- Delete: `apps/driver/app/(driver)/order/[orderId]/start/` (page.tsx + start-form.tsx)

**Does NOT cover:** /start로 향하는 외부 deep link 보호 — 일단 삭제 후 404. 필요 시 redirect to /photos는 R-next.

**Step 1: 디렉토리 삭제 (Windows PowerShell)**
PowerShell:
```powershell
Remove-Item -Recurse -Force "apps/driver/app/(driver)/order/[orderId]/start"
```
또는 Bash 도구 사용:
```bash
rm -rf "apps/driver/app/(driver)/order/[orderId]/start"
```

**Step 2: Verify (grep)**
Run: `grep -r "/start" /c/dev/MOUNT1/apps/driver/`
Expected: order detail에서 [출발]/[시공 시작] 버튼·링크 매치 없음.

**Step 3: Verify**
Run: `pnpm typecheck && pnpm build:driver`
Expected: 통과 (참조 끊긴 import 없음).

**Step 4: Commit**
```bash
git add -A
git commit -m "feat(driver): remove /start page (replaced by /photos guard)"
```

---

## Slice 4 — /photos / /complete 워크플로

> Slice 1 + Slice 3 완료 후.

### Task 4.1: /photos — 진행률 hero + [업로드 완료] CTA

**Files:**
- Modify: `apps/driver/app/(driver)/order/[orderId]/photos/page.tsx`

**Does NOT cover:**
- 사진 부족 차단 — pre=0/post=0 케이스 포함해서 모두 제출 허용. /complete 메모에서 사유 입력.
- pre=0인 경우의 시각적 경고 — 일반 reminder만, 차단 X.

**Step 1: 진행률 hero 추가**
- 페이지 상단에 `{preCount + postCount} / 5` 큰 숫자 카드 추가.

**Step 2: [업로드 완료] CTA 추가**
- 페이지 최하단에 버튼 → `/order/${id}/complete`로 라우팅.
- 미충족 시(`pre < 2 || post < 3`) 위에 small text reminder: "필수 사진 부족. 다음 화면에서 사유 입력하면 진행 가능".

**Step 3: Verify (manual)**
Run: dev + 사진 부분 업로드 → CTA 활성화 + reminder 표시.

**Step 4: Commit**
```bash
git commit -am "feat(driver): /photos progress hero + [업로드 완료] CTA"
```

---

### Task 4.2: /complete — 무타공/타공전환 토글 (B2)

**Files:**
- Modify: `apps/driver/app/(driver)/order/[orderId]/complete/complete-form.tsx`

**Does NOT cover:** 토글 on 시 차액 자동 계산 — 본사 정산 룰 미확정 (현재 코드도 미구현). UI 토글 + DB 저장만.

**Step 1: 토글 컴포넌트**
- 기본값: 무타공 (off). 토글 on 시 → 타공 전환 모드. 토글 옆에 작은 설명 "현장 합의로 타공으로 변경된 경우만".

**Step 2: form 상태 → conversion 필드 매핑**
- 토글 on → `p_conversion = true`, option_selected = 'B_drill'
- 토글 off → `p_conversion = false`, option_selected = 'C_no_drill'

**Step 3: Verify (manual)**
Run: dev + 토글 on/off → 폼 상태 확인.

**Step 4: Commit**
```bash
git commit -am "feat(driver): /complete conversion toggle (B2 — default 무타공)"
```

---

### Task 4.3: /complete — 고객 동의 체크박스

**Files:**
- Modify: `apps/driver/app/(driver)/order/[orderId]/complete/complete-form.tsx`

**Does NOT cover:** 체크박스 false 차단 — false도 제출 허용. 단 RPC가 admin alert 자동 발송 (Slice 1의 RPC 안에 이미 처리).

**Step 1: 체크박스 추가**
- 라벨: "고객 동의 확인 (신분증·결제 안내)"
- 체크박스 + 작은 설명 "체크 안 하면 본사 검수가 알림 받음".

**Step 2: form state → RPC 인자 매핑**
- `p_consent_confirmed = checked`

**Step 3: Verify (manual)**
Run: dev + uncheck 상태로 submit → /complete 후 admin_alerts 조회 → row 존재.

**Step 4: Commit**
```bash
git commit -am "feat(driver): /complete consent checkbox + alert on false"
```

---

### Task 4.4: /complete submit → complete_install_atomic RPC 호출

**Files:**
- Modify: `apps/driver/app/(driver)/order/[orderId]/complete/actions.ts` (확정 — 파일 존재 검증 완료)

**Does NOT cover:** RPC 실패 시 에러 메시지 — 일반 fail 메시지만. 상세 에러 분기는 사용자 피드백 R-next.

**Step 1: server action 변경**
- 기존 `update orders set status=...` 직접 → `client.rpc('complete_install_atomic', { p_order_id, p_option_selected, p_conversion, p_consent_confirmed, p_memo, p_photo_pre_count, p_photo_post_count })` 호출

**Step 2: 사진 카운트 사전 조회**
- submit 시 photos 테이블에서 pre/post 카운트 가져와 인자로 전달.

**Step 3: Verify (manual)**
Run: dev + 정상 시나리오 + 사진 부족 시나리오 모두 → status 변경 + alerts 확인.

**Step 4: Verify build**
Run: `pnpm typecheck && pnpm build:driver`

**Step 5: Commit**
```bash
git commit -am "feat(driver): /complete uses complete_install_atomic RPC"
```

---

## Slice 5 — 예약시각 기사 편집

> Slice 1 (RLS) 완료 후.

### Task 5.1: 개요 — 예약시각 카드에 ✏ 변경 모달 트리거

**Files:**
- Modify: `apps/driver/app/(driver)/order/[orderId]/page.tsx`
- Create: `apps/driver/app/(driver)/order/[orderId]/_components/schedule-edit-modal.tsx`

**Does NOT cover:** 시작 1h 이내 변경 시도 — RPC가 거부 + UI 사전 차단 (버튼 비활성). 충돌 검사는 ±2h 윈도우만 — 그 외 시간대 충돌은 미감지.

**Step 1: 모달 컴포넌트**
- shadcn Dialog 베이스
- date·time picker (native input type=datetime-local 또는 react-day-picker)
- 충돌 fetch 쿼리 (구체):
  ```ts
  client.from('orders')
    .select('id, scheduled_installation_at')
    .eq('assigned_technician_id', technicianId)
    .neq('id', currentOrderId)
    .in('status', ['assigned'])
    .gte('scheduled_installation_at', new Date(newAt.getTime() - 2*60*60*1000).toISOString())
    .lte('scheduled_installation_at', new Date(newAt.getTime() + 2*60*60*1000).toISOString())
  ```
- 결과 N >= 1이면 경고 표시 — "±2시간 내 다른 시공 N건"
- [저장] 버튼 → server action 호출

**Step 2: 개요 카드 변경**
- 예약시각 row 우측에 `✏ 변경` 버튼 → 모달 open
- 시작 1h 이내인 경우 버튼 비활성 + tooltip "1시간 이내 변경은 본사 카카오톡 채널".

**Step 3: server action**
- `client.rpc('update_schedule_by_technician', { p_order_id, p_new_scheduled_at })` 호출
- RPC가 권한·윈도우·trigger alert 자동 처리. 직접 update SQL 사용 X.

**Step 4: Verify (manual)**
Run: dev + 2시간 후 주문 → 시각 변경 → admin_alerts row 생성. 30분 후 주문 → 버튼 비활성.

**Step 5: Commit**
```bash
git commit -am "feat(driver): schedule edit modal with 1h window + admin alert"
```

---

## Slice 6 — 이슈 양방향 (driver 작성 + admin 응답)

> Slice 1 (RLS + 컬럼) 완료 후.

### Task 6.1: driver 이슈 탭 — 작성 폼

**Files:**
- Modify: `apps/driver/app/(driver)/order/[orderId]/page.tsx` (issues tab branch)
- Create: `apps/driver/app/(driver)/order/[orderId]/_components/issue-form.tsx`

**Does NOT cover:** 사진 첨부 (`photo_ids` 컬럼 활용) — R-next+1.

**Step 1: 작성 폼 컴포넌트**
- 6 카테고리 (issues category enum과 일치) + 자유 텍스트 메모
- [이슈 보고] 버튼 → server action

**Step 2: server action**
- `client.from('issues').insert({ order_id, technician_id, category, note })`

**Step 3: Verify (manual)**
Run: dev + 이슈 탭에서 작성 → 저장 후 이력에 row 표시.

**Step 4: Commit**
```bash
git commit -am "feat(driver): issue creation form in issues tab"
```

---

### Task 6.2: driver 이슈 이력 — admin 응답 라인 표시

**Files:**
- Modify: `apps/driver/app/(driver)/order/[orderId]/page.tsx`

**Step 1: 변경**
- 기존 issue 카드 아래에 `admin_response_text`가 null 아닌 경우 emerald 색 라인:
  `✓ 본사 응답 ({admin_response_at}) — {admin_response_text}`

**Step 2: Verify (manual)**
Run: admin SQL 직접 update issues set admin_response_text = 'test' → driver UI에서 emerald 라인 확인.

**Step 3: Commit**
```bash
git commit -am "feat(driver): show admin response line in issue history"
```

---

### Task 6.3: admin /orders/[id] — 이슈 응답 폼

**Files:**
- Modify: `apps/admin/app/(admin)/orders/[id]/page.tsx` (또는 issues 패널 컴포넌트)

**Step 1: 응답 폼**
- 각 issue row 옆에 [응답하기] 버튼 → 인라인 textarea + [전송]
- server action: `update issues set admin_response_text=..., admin_response_at=now(), admin_responder_id=...`

**Step 2: Verify (manual)**
Run: admin dev + 이슈 응답 입력 → driver UI에서 응답 라인 확인.

**Step 3: Commit**
```bash
git commit -am "feat(admin): issue response form in order detail"
```

---

## Slice 7 — Admin 카카오 geocoding 인프라

> 다른 슬라이스와 독립. 좌표 없이도 driver는 fallback으로 동작 (Slice 3.3) — 그러나 본사 운영 품질 위해 필요.

### Task 7.1: 카카오 로컬 API 헬퍼

**Files:**
- Create: `packages/lib/src/kakao-geocoding.ts`

**Step 1: 헬퍼 함수**
```ts
export async function geocodeAddress(addressFull: string): Promise<{lat: number; lng: number} | null> {
  const apiKey = process.env.KAKAO_REST_API_KEY;
  if (!apiKey) throw new Error('KAKAO_REST_API_KEY missing');
  const res = await fetch(
    `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(addressFull)}`,
    { headers: { Authorization: `KakaoAK ${apiKey}` } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const first = data.documents?.[0];
  if (!first) return null;
  return { lat: Number(first.y), lng: Number(first.x) };
}
```

**Step 2: Env 추가**
- `.env.example`에 `KAKAO_REST_API_KEY=` 추가.
- vercel/배포 환경에 실제 key 등록.

**Step 3: Verify (manual)**
Run: `node -e "import('./packages/lib/src/kakao-geocoding.js').then(m => m.geocodeAddress('서울 강남구 테헤란로 152').then(console.log))"`
Expected: lat/lng 반환.

**Step 4: Commit**
```bash
git commit -am "feat(lib): kakao local API geocoding helper"
```

---

### Task 7.2: admin 주문 등록/수정 시 geocoding 자동 호출

**Files:**
- Discover (Step 0): admin 주문 등록·수정 server action 위치 확인
  - Run: `grep -rn "from('orders').insert\|from('customers').update.*address" /c/dev/MOUNT1/apps/admin/`
  - 일반적 위치 추정: `apps/admin/app/(admin)/orders/page.tsx` 또는 `apps/admin/app/(admin)/orders/[id]/page.tsx` 의 server action / action.ts
- Modify: Step 0에서 발견된 파일들

**Does NOT cover:** geocoding 실패 시 admin이 수동 입력 — 폴백 fallback. 본 task는 자동 시도만.

**Step 1: server action 변경**
- 주소 변경 시 `geocodeAddress(addressFull)` 호출 → `customers.address_lat/lng` 업데이트.

**Step 2: Verify (manual)**
Run: admin dev + 주문 등록 → customers row의 lat/lng 채워짐 확인.

**Step 3: Commit**
```bash
git commit -am "feat(admin): auto-geocoding on order/customer save"
```

---

## Slice 8 — 통합 검증

> 모든 슬라이스 완료 후 최종.

### Task 8.1: typecheck / lint / build

**Step 1: 전체 검증**
Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: 모두 통과.

**Step 2: Verify in CI**
Run: `git push` (CI 통과 확인)

---

### Task 8.2: Manual happy path walkthrough

**Step 1: dev 서버**
Run: `pnpm dev`

**Step 2: walkthrough (driver)**
1. /login → 기사 로그인
2. /today → assigned 주문 카드 확인 (Tier 1 시각 — stripe + 시간 컨텍스트)
3. 카드 탭 → /order/[id] 개요 (2탭만 / 고객 카드 🧭📞 / 진행현황)
4. 📞 → /pre-call → outcome=no_answer 저장 → 개요에서 사전통화 ✓ 확인
5. ✏ 예약시각 변경 → admin_alerts row 확인
6. [완료] → /photos → 사진 업로드 → [업로드 완료] → /complete
7. 무타공 토글 off + 동의 체크 + 메모 → 제출 → orders.status = `no_drill_completed` 확인
8. /today 복귀 → 카드가 emerald stripe로 표시

**Step 3: walkthrough (admin)**
9. admin /orders/[id] → 동의 false였으면 admin_alerts에 row
10. 이슈 작성·응답 양방향 확인

**Step 4: 결과 보고**
- 발견된 이슈 → 별도 task 추가
- 모두 통과 → Slice 8.3로

---

### Task 8.3: 와이어 sitemap 동기화

**Files:**
- Modify: `D:\walltvprowiki\13_PROJECT_MANAGEMENT\MOUNTPARTNERS_APP\.lazyweb\design-improve\driver-today-2026-05-05\sitemap-wireframe.html`

**Step 1: 와이어와 실제 구현 사이 GAP 정리**
- 구현 중 발견된 와이어 결정과 다른 부분 (예: 토글 위치, 모달 디테일) → 와이어 갱신 또는 ADR 추가.

**Step 2: README.md 업데이트**
- `.lazyweb/README.md`에 "v2 구현 완료" 표시 + 구현된 commit hash range.

---

## 후속 작업 (R-next+1)

- **이슈 사진 첨부** — `photo_ids[]` 컬럼 활용
- **본사 알림 채널** — admin_alerts → push/slack/email 연동
- **photos_unavailable 카테고리** — 사진 부족 케이스 별도 분류 (현재는 자유텍스트)
- **GPS 추적 / 자동 status 추론** — driver 위치 추적이 필요해질 경우
- **테스트 인프라** — playwright + vitest 도입
- **en_route/on_site/in_progress enum 정리** — 1년 후 사용 0건 확인 시 마이그레이션

---

## Plan Review

Plan 작성 완료. plan-reviewer 서브에이전트로 검증 후 실행 옵션 제시 예정.
