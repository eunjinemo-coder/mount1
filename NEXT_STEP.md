# Next Step

다음 세션 진입 시 바로 이어갈 작업. 3줄 원칙.

---

## 현재 상태 (2026-04-29 · commit 0ae9835)

```
git: main @ 0ae9835 (R7~R12 누적 50+ commits)
검증: typecheck 6/6 ✓ · lint 6/6 ✓ · build 2/2 ✓
라우트: driver 14 + admin 18 = 32 라우트 (+ /settings, /technicians/[id], /orders/[id])
프로젝트 위치: C:\dev\MOUNT1 (SSD)
와이어프레임 매칭률: ~92% (R12 i18n + 헌법 No Dead-End + 4 에이전트 P0)
보안 P0: 0건 (수렴) · P1: 6건 (외부 의존 + 큰 작업)
인증: 로그아웃 + UserMenu (admin) + driver settings · super_admin 발급 작동
시공 lifecycle: state machine + atomic cancel RPC + 사진 가드 UI 완료
이상 징후 알림: B02 패널 작동 (4종 룰 query)
```

## R12 자율 라운드 결정 사항 (2026-04-28~29 · 4 에이전트 종합)

architect / code-reviewer / general-purpose / security-reviewer 4 에이전트 병렬 점검.
P0 8 + P1 15 + P2 6 식별. 결제(B07/B08) 외 모두 fix.

신규 commits (이번 라운드):
- c16d153 P0 batch — assertAdminRole/assertTechnicianSession/CSPRNG/transition guard/actor_id/revalidate
- c80e41f cancel RPC atomic — 0016 단일 트랜잭션 (architect P0-4 근본 해결)
- 0ae9835 A06 사진 가드 UI + B02 이상 징후 알림 패널 (와이어 갭)

이전 R12 자율 commits (참조):
- 1831332 admin UserMenu + 로그아웃 (헌법 제2조 No Dead-End)
- da9d613 /admin/settings B12 화면 + 사이드바 진입
- ef2353c error/loading/not-found 8 boundaries (No Dead-End)
- 302927f /dispatch ERP 표준 (시간 prominent + 점수 progress bar + sticky 요약)
- 27abeb0 시인성·가시성·가독성 — Pretendard + 한국어 타이포 + 컴포넌트 일관성
- 4bdfa7a i18n 영문 → 한글 + 일반인 친화 용어
- d2bd69f callRpc this 손실 + UnassignedBanner 일관

## 잔여 P0/P1 (다음 세션)

자동 fix 가능 (코드만):
- 사진 무결성 SQL (0017 신규) — sha256/taken_at 검증으로 재사용 차단
- driver A09 conversion 분리 (현재 A08 흡수 — 와이어 의도 분리 시 별도 화면)

외부 의존 / 큰 작업:
- B07 결제 링크 (PortOne 가입)
- B08 결제 현황 + Webhook
- A04 미니맵 (Kakao SDK)
- B06 Live (Kakao SDK)
- A03 driver 캘린더 (큰 신규 화면)
- A11 driver 정산 (큰 신규 화면)
- A13 driver 휴가 등록
- B10 클레임 관리
- technicians.phone 암호화 (PIPA 강화)
- rate limiting (Upstash Redis)
- IP whitelist 검증 (admin proxy.ts)



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

## R11 완료 항목 (방금)

1. ✅ **0015 dev seed** — customers 5 + orders 12 (status 분포) + installations + cancel report
   · 멱등 do$$ 블록 (SEED_MARKER_DEV 로 재실행 안전)
   · 첫 active technician 자동 lookup → 배차/완료 케이스 매핑
   · 미배차 4건 → dispatch 추천 알고리즘 검증 가능
   · ⚠️ prod 절대 push 금지
2. ✅ **scripts/e2e-admin-smoke.ps1** — 11 endpoint + Supabase auth API + JWT decode
3. ✅ **_E2E_CHECKLIST.md** — 60+ 체크박스 (admin 8 영역 + driver 9 영역 + DB 검증 SQL)

## R10 완료 항목

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
