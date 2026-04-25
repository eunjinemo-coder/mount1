# 1차 중간점검 결과보고서

- **일자**: 2026-04-25
- **D-Day 까지**: 8일 (2026-05-03 쿠팡 본사 미팅 + 첫 실전 시공)
- **현재 진척**: Phase 0 인프라 + R1 Foundation + R2 Pages + R3 Workflow (6 commit, 8 패키지, ~5,000 LOC + ~1,650 SQL)
- **점검 방식**: 4 전문 에이전트 병렬 dispatch (code-reviewer · security-reviewer · general-purpose · e2e-runner)

---

## 종합 판정

| 영역 | 결과 | P0 | P1 | P2 |
|---|---|---|---|---|
| 🔍 코드 품질 | ⚠️ WARNING | 2 | 8 | 5 |
| 🛡️ 보안 | ⚠️ WARNING | 4 | 7 | 5 |
| 🧪 빌드/통합 | ✅ GREEN | 0 | 2 (경고) | — |
| 📸 UI/UX 와이어프레임 대조 | ⚠️ WARNING | 2 | 18 | 11 |

**중복 제거된 고유 P0**: 6건 (코드 변경) + 1건 (환경)
**전체 와이어프레임 평균 매칭률**: 약 48% (R3 까지 골격, 보조 UX 미구현)

**런칭 차단 요인**: 있음 (P0 6건 즉시 수정 필요)
**아키텍처 신뢰도**: 높음 (RLS·Service Role 격리·PII 스크럽·typecheck/lint/build 전 항목 통과)

---

## 🔴 P0 (즉시 수정) — 7건

### P0-1: middleware.ts 양쪽 앱 모두 인증 검증 부재 (통합 — 코드 + 보안)
- **파일**: `apps/{driver,admin}/middleware.ts`
- **문제**: 두 파일 모두 `return NextResponse.next()` 만 실행, 세션·IP 검증 없음.
- **영향**: API 경로(`/api/*`)가 인증 없이 노출. JS 비활성화 환경에서 일부 우회 가능. 관리자 IP whitelist (헌법 §9) 미구현.
- **수정**: Supabase SSR 세션 갱신 + 미로그인 redirect. IP whitelist 는 Phase 2 이관 결정.

### P0-2: `apps/driver/app/offline/page.tsx` React 타입 임포트 누락
- **파일**: `apps/driver/app/offline/page.tsx:3`
- **문제**: `React.ReactElement` 반환 타입 사용 시 import 없음. 빌드는 통과했지만 strict 환경에서 잠재 위험. + 한글 문자열을 유니코드 이스케이프(`오...`)로 하드코딩.
- **수정**: `import type { ReactElement } from 'react';` + 한글 직접 작성.

### P0-3: `is_admin()` 헬퍼가 auditor 도 통과 → 감사자 쓰기 권한 획득
- **파일**: `supabase/migrations/0002_rls.sql`
- **문제**: 5개 정책 (`orders_update_admin`, `photos_update_admin`, `issues_mutate_admin`, `install_update_tech`, `notifications_admin_all`) 이 `is_admin()` 만 체크 → auditor 가 쓰기 권한 획득.
- **영향**: 감사 역할이 주문/사진/이슈/시공/알림 데이터 위변조 가능 → PIPA 감사 무결성 위반.
- **수정**: `is_admin()` → `has_admin_role(array['super_admin','cs_admin','dispatch_admin','ops_admin'])` 로 교체 (auditor 제외).

### P0-4: 트리거 함수 3종 search_path 미설정
- **파일**: `supabase/migrations/0001_init.sql` (set_updated_at, audit_order_status_change, audit_lead_time_override)
- **문제**: search_path injection 가능 (슈퍼유저 권한 탈취 시 노출).
- **수정**: 모든 함수에 `set search_path = public` 추가.

### P0-5: 뷰 `v_orders_dashboard`, `v_technician_today` security_invoker 미설정
- **파일**: `supabase/migrations/0001_init.sql`
- **문제**: PostgreSQL 15+ 에서 뷰 기본은 owner 권한 실행. RLS 정책이 호출자 아닌 owner 에게 평가 → RLS 우회.
- **수정**: `with (security_invoker = true)` 추가.

### P0-6: 결제 금액 기사 화면 노출 — PERMISSIONS §5.6 명시적 금지 위반
- **파일**: `apps/driver/app/(driver)/order/[orderId]/page.tsx` 74-76, 140-150
- **파일**: `apps/driver/app/(driver)/order/[orderId]/complete/complete-form.tsx` 25, 62
- **문제**: `price_option_b`, `price_option_c`, 전환 차액 KRW 금액 직접 표시. PERMISSIONS §5.6 — 기사는 결제 정보 조회 금지, "결제 배지" 만 허용.
- **영향**: 보안 위반 + 권한 정책 위반. RLS 가 막더라도 코드 자체에 노출 의도가 있음 → 기획 위반.
- **수정**: orders 쿼리에서 price_* 필드 제거, complete 폼에서 차액 표시 제거 (텍스트 안내만).

### P0-7: driver 앱 포트 3000 충돌 (환경)
- **문제**: 동일 머신 partner-landing 앱이 3000 점유 → driver dev 기동 실패.
- **수정**: partner-landing 또는 driver 의 dev 포트 변경 (또는 README 에 dev 실행 순서 문서화).
- **분류**: 환경/운영 이슈, 코드 변경 아님.

---

## 🟠 P1 (런칭 전 수정) — 합산 30+건 (영역 중복 제거)

### 보안 (Top 7)
- **P1-S1**: `captureError(context)` 가 PII scrubbing 없이 Sentry 전송 → context 우회 PII 누출 위험.
- **P1-S2**: 관리자 로그인 `adminRoleHint` 클라이언트 결정 → fake email 열거 + 다른 역할 시도 가능.
- **P1-S3**: CSP 헤더 미설정 (양 앱).
- **P1-S4**: Server Action UUID 형식 검증 없음 (zod 등).
- **P1-S5**: `notifications.idempotency_key` not null 누락 → 중복 알림 가능.
- **P1-S6**: PIPA 자동 삭제 cron 격리 (`migrations_pending/0003`) → 보관기간 만료 데이터 자동 삭제 미작동.
- **P1-S7**: IP whitelist middleware 코드 자체 없음.

### 코드 dead-end (Top 4)
- **P1-C1**: `start-form.tsx` → `/order/[id]/photos` 로 redirect 하지만 라우트 미구현 → **D-Day 시공 완료 플로우 차단**.
- **P1-C2**: `empty-state.tsx` → `/calendar` 미구현 라우트.
- **P1-C3**: order detail → `/order/[id]/cancel` 미구현 라우트.
- **P1-C4**: 관리자 역할 클라 결정 (보안 P1-S2 와 중복).

### UI/UX 와이어프레임 대조 (영역별 누락 핵심)
- **A01 driver_login** (매칭 60%): PW 눈 토글·기기 유지 체크·비번 분실 링크·버전 표기 누락
- **A02 driver_today** (매칭 40%): 3탭(실시간/일괄/지도)·상단 헤더·하단 탭바·이상 징후 배너 누락. 사진 카운트 `/6` vs 와이어 `/10` 불일치
- **A04 driver_order_detail** (매칭 35%): 4탭·미니맵·길찾기 딥링크·tel 링크·해피콜 섹션·30분 전 통화 섹션·진행 타임라인 누락 (+ 결제 금액 P0-6)
- **B01 admin_login** (매칭 79%): PW 눈 토글·기기 기억(30일)·버전 표기 누락
- **B02 admin_today** (매칭 35%): 글로벌 헤더·사이드바·이상 징후 알림·Realtime 구독·KPI 5번째 카드(미결제·이슈) 누락
- **B05 admin_dispatch** (매칭 43%): 3패널 레이아웃(지도)·점수 알고리즘·Gini 지수·날짜 네비·자동 배차 모달 누락

### 빌드 경고 (Top 2)
- **P1-B1**: middleware → proxy 파일명 변경 (Next.js 16 deprecation, 현재 경고만)
- **P1-B2**: `@serwist/next` + Turbopack 호환 경고 (dev 모드 SW 비활성, build 영향 없음)

---

## 🟡 P2 (점진 개선) — 합산 21건 (생략, 각 에이전트 보고서 참조)

대표:
- `toSafeRedirectPath` 4곳 중복 → `@mount/lib` 추출
- `offline/page.tsx` 디자인 토큰 미사용 (`bg-white` 하드코딩)
- 사진 슬롯 매직넘버
- 한국 휴대폰 정규식 false negative (구 번호 011-019)
- webhook_verified 검증 코드 미구현

---

## 📊 검증 메트릭 요약

```
typecheck 6/6 ✓ (2m39s)  |  lint 6/6 ✓ (3m04s)  |  build 2/2 ✓ (4m55s)
any/@ts-ignore 위반: 0건 (실제 코드)
console.* 누출: 0건 (logger.ts 외)
의존성 취약점: 직접 0건, transitive 2건 (moderate, Sentry/Next 업스트림)

SQL 객체: 테이블 21 ✓ · 정책 55 ✓ · RPC 6 ✓
라우트 빌드: driver 8/8, admin 4/4 (누락 0)

OWASP Top 10: A02·A03·A09·A10 ✅ / A01·A04·A05·A06·A07·A08 ⚠️
PIPA: PII 암호화 ✅ / 자동삭제·동의 절차 ⚠️
```

---

## 🎯 자동 수정 계획 (P0/P1 우선순위)

### Round 1 — P0 자동 수정 (이번 세션)

| # | 항목 | 파일 | 예상 LOC |
|---|---|---|---|
| 1 | offline React 타입 임포트 + 한글 직접 작성 | `apps/driver/app/offline/page.tsx` | 5 |
| 2 | 결제 금액 기사 화면 제거 (PERMISSIONS §5.6) | `order/[id]/page.tsx`, `complete-form.tsx` | 30 |
| 3 | middleware 세션 검증 (Supabase SSR) | `apps/{driver,admin}/middleware.ts` | 80 |
| 4 | DB 보안 fix migration | `supabase/migrations/0006_security_fix.sql` (신규) | 150 |
| | - auditor 권한 분리 (5 정책 교체) | | |
| | - 트리거 search_path 추가 (3 함수) | | |
| | - 뷰 security_invoker (3 뷰) | | |
| | - notifications.idempotency_key not null | | |

### Round 2 — P1 즉시 수정 (시간 허용 시)

- start-form `/photos` → `/order/[id]` 임시 redirect (dead-end 회피)
- empty-state `/calendar` → `/today` (1줄)
- order detail `/cancel` 버튼 비활성화 (또는 stub 페이지)
- 관리자 로그인 역할 드롭다운 보안 수정 (서버 결정 패턴)
- captureError context PII scrub
- toSafeRedirectPath helper 추출

### Round 3 — 다음 세션 (R4 작업으로 통합)

- 와이어프레임 누락 UX 요소 (PW 눈 토글·기기 유지·하단 탭바·3탭 등)
- 미니맵·지도 패널 (Kakao Maps SDK 필요)
- Realtime 구독·자동 새로고침
- 사진 업로드 화면 (A07 + Storage 버킷)
- 취소 리포트 (A10)
- 글로벌 헤더·사이드바 레이아웃

---

## 다음 라운드 진입 조건

✅ Round 1 P0 6건 모두 적용 + 재검증 (typecheck/lint/build) 통과
✅ 0006_security_fix.sql 작성 (적용은 은진님 `supabase db push`)
✅ commit + push 완료
✅ 본 보고서 commit

이후 Round 2/3 는 우선순위 협의 후 R4 작업과 함께 진행.

---

## 보고서 작성: Lead PM (Claude)
- 코드 리뷰: code-reviewer 에이전트
- 보안 검증: security-reviewer 에이전트
- 빌드/통합: general-purpose 에이전트
- UI/UX 통합: e2e-runner 에이전트

---

# 2차 점검 (2026-04-25/26 — Round 2)

## 변경
- 1차 P0 6건 자동 fix 적용 (commit a896288)
- R4 화면 추가: A05 pre-call · A10 cancel · B03 orders · technicians · stub 7개 (commit 577b011)
- 글로벌 셸 도입: DriverShell + AdminShell (와이어프레임 매칭률 ~48% → ~60%)

## 4 에이전트 결과 (병렬)
| 영역 | 1차 | 2차 | 비고 |
|---|---|---|---|
| 코드 | WARN | WARN | 신규 P0 2 (photos requireRole, cancel orders.update 미체크) |
| 보안 | WARN | WARN | 신규 P0 1 (cancel stub UUID + 내부정보 노출) + 0005 idempotency_key 누락 발견 |
| 빌드/통합 | GREEN | GREEN | 22 라우트 빌드 성공 |
| UI/UX | 48% | 60% | DriverShell+AdminShell 효과 (+12%p) |

## 2차 자동 fix (commit 0a96b04)
- photos/page requireRole 추가
- cancel/actions: session.technicianId 사용 + UUID 검증 + orders.update 오류 체크 + 내부 정보 노출 제거
- pre-call/actions UUID 검증 + page 상태 검증
- order detail customer 조회 fix (orderId → customer_id)
- 0005 notifications insert idempotency_key 추가 (RPC 충돌 방지)
- 0006 auditor 정책 멱등성 (drop if exists)
- 0007_security_round2.sql 신규 (technicians cs/ops/auditor read 정책)
- middleware → proxy (Next.js 16 deprecation 해소)
- technicians/page phone 마스킹

## R5 진입 (commit 70c3e26 · 755ed87 · 4677abb)
- A07 photos 본격 구현 (Storage 6 슬롯)
- 실 technician_name 조회
- B02 KPI 6 카드 (미결제·이슈 추가)
- B03 필터 8그룹 + 페이지네이션 (PAGE_SIZE=25)

## 잔존 P1 (R6 backlog)
- 관리자 역할 서버 결정 (admin_users.username 컬럼 + RPC)
- A05 결과 7종 + tel: 딥링크 (전화번호 복호화 RPC 필요)
- A10 5 step 폼 + SignaturePad 캔버스
- driver/order detail 4 탭 (개요·사진·이슈·통화)
- CSP 헤더 설정
- A02 driver today 3 탭 (실시간·일괄·지도)
- B05 dispatch 3 패널 (지도·점수·Gini)
- realtime 구독 (admin today 30초 갱신)


---

# 3차 점검 (2026-04-26 — Round 3, 수렴 검증)

## 변경 (2차 → 3차)
- 2차 P0/P1 fix 적용 후 R5 본격 진입
- 추가 commits: 70c3e26 (R5 photos) · 755ed87 (실명+KPI6) · 4677abb (B03 필터+페이지) · 6a8d280 (detail 진행도) · b674de3 (Round 3 P1 fix) · 87fdb9e (SignaturePad) · f1e710c (썸네일) · 481a6da · 0aabe0c (DRY)
- 마이그레이션 추가: 0007_security_round2.sql · 0008_storage_rls.sql

## 3차 검증 결과 (보안 + UI/UX 2 에이전트)

### 보안
- **P0: 0건** (수렴 달성!)
- P1: 2건 → 즉시 fix
  - P1-R5-1: Storage 버킷 RLS SQL 미명시 → 0008_storage_rls.sql 작성
  - P1-R5-2: Photos race condition → 슬롯별 고정 경로 + upsert: true
- OWASP Top 10:
  - 1차: A01·A04·A05·A06·A07 WARN
  - 3차: A01·A03·A05·A07·A09 GREEN, A04 WARN (Storage 버킷 미생성 시)
- PIPA: 자동삭제 cron 만 미적용 (Pro 전환 후)

### UI/UX (와이어프레임 매칭률)
- **1차 48% → 2차 60% → 3차 78%** (+30%p 누적)
- A07 photos: 10% → 78% (+68%p, R5 본격 구현 효과)
- A02 driver_today: 40% → 76% (셸 + 실명)
- B02 admin_today: 35% → 80% (셸 + KPI 6 카드)
- 시공 lifecycle 8단계 모두 PASS

### 시공 lifecycle E2E
| 단계 | 라우트 | 상태 |
|---|---|---|
| 1. 로그인 | /login | PASS |
| 2. 오늘 목록 | /today | PASS |
| 3. 주문 상세 | /order/[id] | PASS |
| 4. 사전 통화 | /pre-call | PASS |
| 5. 시공 시작 | /start | PASS |
| 6. 사진 업로드 | /photos | PASS |
| 7. 시공 완료 | /complete | PASS |
| 8. 취소 리포트 | /cancel | PASS (SignaturePad 적용) |

## 3차 자동 fix
- 0008_storage_rls.sql 신규 (photos-hot · signatures · cls-reports-draft 버킷 RLS)
- photos/actions: race condition fix (고정 경로 + upsert)
- 사진 썸네일 미리보기 (signed URL 1시간)
- A10 SignaturePad 자체 구현 (Canvas + Pointer Events, 외부 패키지 0)
- login PW 표시 토글 (Eye/EyeOff)
- B03 필터 8그룹 + 페이지네이션 (PAGE_SIZE 25)
- order detail 진행 현황 카드 (사전 통화 + 사진 진행도)
- toSafeRedirectPath @mount/lib/navigation 추출 (P2-1)

## 잔존 P1 (R7 backlog · 상용화 진입 전 해소)
- tel: 딥링크 (전화번호 복호화 RPC + AES-GCM 서버키)
- A02 3탭 (실시간/일괄/지도 — Kakao Maps SDK)
- A04 4탭 (개요/사진/이슈/통화 분리)
- B02 Realtime 30초 갱신 (Supabase Realtime 구독)
- B05 추천 점수 알고리즘 (Gini · 거리 · 등급 · 부하)
- 관리자 역할 서버 결정 (admin_users.username + RPC)
- CSP 헤더 (next.config)
- pnpm audit transitive 2건 (Sentry/Next 업스트림 대기)

## 수렴 판정
**P0: 0 · P1 (R5 내): 0 · P1 (R6 backlog): 8 · 와이어 매칭률 78%**

상용화 기준 (85% 와이어 매칭) 까지 7%p 갭. R7 핵심 3건(tel·realtime·점수 알고리즘) 처리 시 도달 가능.

