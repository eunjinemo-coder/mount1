# Next Step

다음 세션 진입 시 바로 이어갈 작업. 3줄 원칙.

---

## 현재 상태 (2026-04-28 · commit 179adb8)

```
git: main @ 179adb8 (R7~R10 누적 35+ commits)
검증: typecheck 6/6 ✓ · lint 6/6 ✓ · build 2/2 ✓
라우트: driver 14 + admin 16 = 30 라우트
프로젝트 위치: C:\dev\MOUNT1 (HDD D:\ → SSD C:\ 이전 완료)
와이어프레임 매칭률: ~97% (R9=95% → R10 = +2%)
보안 P0: 0건 · P1: 5건 (백로그)
인증/로그인: 정상 동작 (super_admin 발급 + admin /today 진입 확인)
운영 가능 항목: 기사 발급/잠금/등급/상태/한도 + 주문 상세/수동 변경 + 정산 CSV +
              사진 압축+EXIF + 추천 알고리즘 + Realtime + tel 딥링크 + 일괄 처리 + 취소 전달
의존성: 2 moderate (uuid<14 / postcss<8.5.10) — Sentry/Next 패치 대기
```

## 다음 세션 진입 시 1단계 — 은진님 액션

```bash
cd C:\dev\MOUNT1 && git pull
supabase db push                           # 0009~0014 6개 마이그레이션 적용
pnpm --filter @mount/db db:types:dev       # types regenerate (RPC 7 + recommend 1 추가)
```

기 적용 작업 (한 번만):
- ✅ Auth → Hooks → Custom Access Token Hook 활성화
- 🟡 Storage → photos-hot · signatures · cls-reports-draft 3 버킷 생성
- 🟡 Settings → Vault → `pii_key` secret 등록 (openssl rand -base64 32)
- ✅ super_admin 발급 (Dashboard "Add user" 사용 — `mountpartners.cloud` 도메인)

## R8 완료 항목 (이번 라운드)

1. ✅ Admin Realtime (orders/installations/issues postgres_changes 구독 + 60s fallback)
2. ✅ Driver shell pathname 자동 active tab (BottomNav use client 분리)
3. ✅ Driver next.config CSP dev/prod 분리 + Sentry region host 보강
4. ✅ tel: 딥링크 (PII 복호화 RPC + Vault 키 + Driver UI 전화 버튼)
5. ✅ B05 추천 점수 (Haversine + 등급 + 부하 + 선호 + 공정성)
6. ✅ A02 일괄 처리 탭 (표 + 다중 통화 일괄 기록)
7. ✅ Cancel 사진 자동 첨부 (photos 본인 + 본 order 자동 link)
8. ✅ _HANDOFF SQL 완전판 (super_admin + technician — aud + identities + NOT NULL 토큰)

## R9 완료 항목 (이번 라운드)

1. ✅ **/admin/technicians/new** — 협력기사 등록 + 자동 발급 (super_admin only)
   · auth.admin.createUser → identities 자동 매핑 + technicians INSERT 트랜잭션
   · 12자 강한 임시 비번 자동 생성 + Fisher-Yates 셔플 + 1회 표시 + Copy 버튼
2. ✅ **B11 정산 자동 CSV** — `/api/payouts/csv` route handler
   · 기간 프리셋 4개 + custom date · 기사별 옵션 분포 + 전환 건수 · UTF-8 BOM Excel 호환
3. ✅ **A07 클라이언트 사진 압축** — createImageBitmap + OffscreenCanvas + WebP
   · 1920px + quality 0.85 · 평균 5MB → 1MB 이하 (대역폭 70%+ 절감)
   · photos.width/height 메타 자동 채움 · EXIF 추출은 R10 (exifr 의존성)
4. ✅ **/admin/coupang 취소 리포트 일괄 전달** — pending → transferred_manually 마킹
   · 다중 선택 + 3 모드 (수기/일일/주간 묶음) · count: 'exact' 검증

## R10 완료 항목 (이번 라운드)

1. ✅ **0013 Hook 권한 복구** — `Database error querying schema` 해소 (try/except + grant 멱등 재선언)
2. ✅ **fake email 도메인 교체** — `internal.X` 거부 → `mountpartners.cloud` (auth/users + identities update SQL 포함)
3. ✅ **admin root `/` page** — `/today` 자동 redirect (404 차단)
4. ✅ **getSession DB fallback** — JWT 비어있으면 admin_users / technicians 직접 조회 (Hook 깨져도 작동)
5. ✅ **0014 technicians_select_auth_self** — driver fallback 위한 RLS 정책
6. ✅ **dev Sentry skip** — instrumentation 매 요청 ~93ms 오버헤드 제거 (NODE_ENV !== production)
7. ✅ **/admin/technicians/[id]** — 잠금 해제/등급/상태/한도 변경 + 최근 7일 활동 통계 (super_admin only)
8. ✅ **A07 EXIF 추출** — exifr@^7 + photos.taken_at/lat/lng 자동 채움 (압축 전 원본에서)
9. ✅ **/admin/orders/[id]** — 기본정보 + 기사 + 통계 + 이력 + status/scheduled 수동 변경

## R11 후보 (다음 세션)

1. **Kakao Maps SDK** — A02 지도 탭 + B06 admin live (key 발급 후)
2. **B03 ETL 업로드** — 쿠팡 양식 확정 후 CSV/XLSX import
3. **B07 PortOne 결제 링크** — Webhook + 결제 상태 sync (가맹점 가입 후)
4. **사진 lifecycle** — Hot → Warm 30일, R2 이관
5. **E2E 테스트** (Playwright + Vercel Browser)

## 잔존 백로그

- pg_cron 본문 (prod Pro 전환 후 0003_cron 적용)
- next-pwa Turbopack 호환 (Phase 2)
- 관리자 IP whitelist 검증 (Phase 2)
- Sentry source map 업로드 (Auth Token 발급 후)
- Login server action debug log 정리 (P3)
- types.generated.ts regenerate (db push 후 자동 — 일부 컬럼 GenericStringError 우회 중)
