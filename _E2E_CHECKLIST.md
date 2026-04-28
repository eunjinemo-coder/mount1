# E2E 수동 체크리스트

자동화는 `scripts/e2e-admin-smoke.ps1` 으로. 아래는 사람이 직접 클릭해서 검증하는 항목.

## 사전 조건

- [ ] `git pull` (commit 최신 동기화)
- [ ] `supabase db push` 적용 — 0013/0014/0015 까지
- [ ] Supabase Dashboard:
  - [ ] Auth Hooks → Custom Access Token Hook **ON**
  - [ ] Storage 버킷 3개 생성 (photos-hot · signatures · cls-reports-draft)
  - [ ] (선택) Vault → `pii_key` 등록 — 미등록 시 `tel:` 딥링크만 작동 안 함
- [ ] dev 서버 2개 띄움
  - [ ] `pnpm --filter @mount/admin dev` (port 3001)
  - [ ] `pnpm --filter @mount/driver dev` (port 3000)

---

## 1. Admin 앱 (localhost:3001)

### 1.1 로그인 / 권한
- [ ] `/login` → 대표 / `eunjin` / `Qkqwntpdy1!` → `/today` 로 redirect
- [ ] 로그아웃 후 `/today` 직접 접근 → `/login?redirect=/today` 로 redirect
- [ ] 잘못된 비밀번호 → "아이디 또는 비밀번호가 올바르지 않습니다" 메시지
- [ ] 잘못된 role 선택 (예: 본사CS) + 같은 비번 → 동일 거부 메시지

### 1.2 Today (실시간)
- [ ] `/today` 진입 → 오늘 시공 목록 + 자동 새로고침 indicator (실시간/폴링/연결중)
- [ ] 다른 탭에서 `/orders/<id>` 의 status 변경 → today 카운트 즉시 반영 (Realtime 구독)
- [ ] 30~60초 대기 → 폴링 fallback 색상 변경 확인 (네트워크 끊고 다시 연결)

### 1.3 Orders
- [ ] `/orders` → 8 필터 그룹 (전체/대기/예약/진행/완료/결제/취소/마감) 클릭
- [ ] 페이지네이션 (25개씩) 동작
- [ ] 행 클릭 → "상세 →" 링크 → `/orders/<id>` 진입
- [ ] `/orders/<id>` 에서:
  - [ ] 기본 정보 카드 (TV/옵션/시각/접수/해피콜/벽/전환/배차) 표시
  - [ ] 담당 기사 카드 → "기사 상세 →" 링크
  - [ ] 사진/이슈/통화 카운트 (0 일 수 있음)
  - [ ] 최근 이력 (audit_events)
  - [ ] **상태 수동 변경**: 다른 status 선택 → 변경 — 결과 success 메시지 + 즉시 반영
  - [ ] **시공 일시 변경**: datetime-local 변경 → 저장 — 반영 확인
  - [ ] **시공 일시 미정으로**: 비우기 → 반영
  - [ ] audit_events 에 `order.status_manual_override` / `order.schedule_manual_change` 기록 확인

### 1.4 Dispatch (배차)
- [ ] `/dispatch` → 미배차 주문 (좌) + 활성 기사 (우)
- [ ] 미배차 주문 클릭 → **추천 카드** 자동 fetch (Sparkles 아이콘)
  - [ ] 추천 5명 표시 (점수 / 거리 / 오늘부하 / 주간부하 / 선호지역)
  - [ ] 추천 0명 시 "모두 한도 초과" 메시지
- [ ] 추천 카드에서 기사 클릭 → 우측 활성 기사 목록도 같이 highlight
- [ ] 또는 우측 활성 기사 직접 선택
- [ ] 하단 "배차 확정" → 성공 시 router.refresh() — 미배차 목록에서 사라짐

### 1.5 Technicians
- [ ] `/technicians` → 협력기사 목록 (이름/login_id/전화 마스킹/등급/상태/한도/주말)
- [ ] 우상단 super_admin 만 "신규 발급" 버튼 노출
- [ ] `/technicians/new`:
  - [ ] 폼 입력 → 발급 → 결과 카드 (login_id + 임시 비번 + Copy 버튼)
  - [ ] 동일 login_id 재시도 → "이미 사용 중" 에러
  - [ ] login_id 형식 오류 (대문자/숫자 시작) → 즉시 검증
- [ ] 행 "상세 →" → `/technicians/<id>`:
  - [ ] 기본 정보 + 최근 7일 활동
  - [ ] 잠금 상태 Badge (정상)
  - [ ] **등급 변경**: bronze → silver → 변경 — 즉시 반영
  - [ ] **상태 변경**: active → paused → 변경
  - [ ] **한도 변경**: 일일 6 → 8 + 주말 ON → 저장

### 1.6 Payouts (정산 CSV)
- [ ] `/payouts` → 기간 프리셋 4개 (이번주/지난주/이번달/지난달) 클릭 시 input 변경
- [ ] custom from/to 변경 가능
- [ ] **CSV 다운로드** 버튼 → 파일 다운로드 (UTF-8 BOM, Excel 한글 호환)
- [ ] 파일 열어서 헤더 + 행 분포 확인 (기사명/login_id/등급/총완료/옵션ABC/전환건)

### 1.7 Coupang (취소 리포트 일괄 전달)
- [ ] `/coupang` → 미전달 취소 리포트 표
- [ ] 행 체크박스 → 다중 선택
- [ ] **수기 전달 완료** / **일일 묶음** / **주간 묶음** 버튼 → 마킹 성공 메시지 + 행 사라짐 (status='pending' 만 보이므로)

### 1.8 Live
- [ ] `/live` → R7+ 의 라이브 보드 (시공 현황) 표시

---

## 2. Driver 앱 (localhost:3000)

> 협력기사 계정 필요 — admin 의 `/technicians/new` 에서 `kim_minsu` 같은 ID 로 발급 후 진행.

### 2.1 로그인
- [ ] `/login` → 발급된 login_id + 임시 비번 → `/today` 로 redirect
- [ ] 하단 BottomNav (홈/예약/정산/설정) 4탭 표시

### 2.2 Today (3 탭)
- [ ] `/today?tab=realtime` (default) → 오늘 시공 카드 목록
  - [ ] 카드 클릭 → `/order/<id>` 진입
  - [ ] 통화 미기록 카드에 PhoneCall Badge
- [ ] `/today?tab=batch`:
  - [ ] 표 형태 (선택/상태/지역TV/통화/사진/진행)
  - [ ] 통화 미기록 행 다중 선택 → "선택 일괄 통화 기록" → 일괄 완료
- [ ] `/today?tab=map`:
  - [ ] R10 placeholder (Kakao Maps SDK 도입 예정)

### 2.3 Order Detail (4 탭)
- [ ] `/order/<id>?tab=overview` → 기본 정보 + 액션 버튼
- [ ] `?tab=photos` → 사진 슬롯 그리드
- [ ] `?tab=issues` → 이슈 카드
- [ ] `?tab=calls` → 통화 기록 카드

### 2.4 Pre-call (사전 통화)
- [ ] `/order/<id>/pre-call` → 고객 연락처 카드 + **전화 걸기** 버튼
  - [ ] 클릭 → tel: 다이얼러 호출 (Vault pii_key 등록 시)
  - [ ] 미등록 시 "서버 키 미설정" 메시지
- [ ] 통화 결과 7개 라디오 → 저장 → 분기:
  - [ ] `customer_cancelled` → `/order/<id>/cancel` 자동 진입

### 2.5 Photos
- [ ] `/order/<id>/photos` → 슬롯 카드 그리드
- [ ] 카드 클릭 → 갤러리 / 카메라
- [ ] **선택 후 자동**: 압축 (1920px WebP) + EXIF 추출 + 업로드
- [ ] 업로드 완료 시 thumbnail + Check 마크
- [ ] photos 테이블 확인 — width/height/taken_at/lat/lng 채워졌는지 (psql 또는 Supabase Dashboard)

### 2.6 Start
- [ ] `/order/<id>/start` → 사전 사진 검증 → "시공 시작" 버튼
- [ ] 사진 미충족 시 에러 메시지

### 2.7 Complete
- [ ] `/order/<id>/complete` → 무타공/타공 전환 라디오 + 합의 방법
- [ ] 완료 → status=`no_drill_completed` 또는 `drill_converted_completed`

### 2.8 Cancel
- [ ] `/order/<id>/cancel` → 취소 사유 + 상황 노트 + 서명패드 (canvas)
- [ ] 제출 → cancellation_reports INSERT (photo_ids 자동 첨부)

### 2.9 BottomNav
- [ ] /order/<id>/* 진입 시 BottomNav 의 "홈" 탭 강조 (usePathname 자동)
- [ ] /profile → "설정" 탭 강조

---

## 3. DB / Supabase 검증

### 3.1 마이그레이션
```sql
select version from supabase_migrations.schema_migrations order by version;
-- 0001/0002/0004/0005/0006/0007/0008/0009/0010/0011/0012/0013/0014/0015
```

### 3.2 Hook 작동
```sql
-- super_admin 의 JWT 시뮬레이션
select public.custom_access_token_hook(
  jsonb_build_object(
    'user_id', (select id from auth.users where email = 'super_admin_eunjin@mountpartners.cloud'),
    'claims', '{}'::jsonb
  )
);
-- 결과: claims.app_metadata.user_type='admin', admin_role='super_admin'
```

### 3.3 Realtime publication
```sql
select schemaname, tablename
  from pg_publication_tables
 where pubname = 'supabase_realtime'
   and schemaname = 'public';
-- orders / installations / issues 모두 보여야 함
```

### 3.4 RPC
```sql
-- 추천 알고리즘 (미배차 주문 ID 사용)
select * from public.rpc_admin_recommend_technicians(
  (select id from orders where status = 'received' limit 1),
  5
);
```

### 3.5 Storage 버킷
```sql
select id, name, public from storage.buckets;
-- photos-hot / signatures / cls-reports-draft 모두 public=false
```

---

## 4. 자동 검증 (CI 후보)

```powershell
# admin dev 서버 띄운 상태에서
.\scripts\e2e-admin-smoke.ps1
```

11 endpoint 의 status code 검증 + Supabase auth API 직접 호출 + JWT app_metadata 확인.

---

## 발견 시 보고

각 [ ] 옆에 결과 표시:
- ✅ 정상
- ⚠️ 작동하나 UX 이슈
- ❌ 작동 안 함 (커밋/SQL/세션 어느 단계에서 실패인지 함께)
