# Next Step

다음 세션 진입 시 바로 이어갈 작업. 3줄 원칙.

---

## 현재 상태 (2026-04-26 · commit cb55ef8)

```
git: main @ cb55ef8 (15 commits 누적)
검증: typecheck 6/6 ✓ · lint 6/6 ✓ · build 2/2 ✓
라우트: driver 14 + admin 9 = 23 라우트 빌드
와이어프레임 매칭률: 1차 48% → 2차 60% → 3차 78%
보안 P0: 0건 (수렴 달성)
시공 lifecycle 8단계: 모두 PASS (login → today → detail → pre-call → start → photos → complete → cancel)
```

## 다음 세션 진입 시 1단계 — 은진님 액션 (`_HANDOFF.md` 참조)

```bash
cd D:\MOUNT1 && git pull
supabase db push                           # 0005~0008 4개 마이그레이션 적용
pnpm --filter @mount/db db:types:dev       # types regenerate
```

추가:
- Dashboard → Auth → Hooks → Custom Access Token Hook 활성화
- Dashboard → Storage → photos-hot · signatures · cls-reports-draft 3 버킷 생성
- 첫 super_admin 계정 발급 SQL (HANDOFF #4)

## R7 후보 (다음 라운드 — 매칭률 78% → 85%+ 목표)

1. **A02 driver today 3탭** (실시간/일괄/지도) — Kakao Maps SDK 도입
2. **A04 driver order detail 4탭** (개요/사진/이슈/통화 분리)
3. **B05 dispatch 추천 점수 알고리즘** (Gini · 거리 · 등급 · 부하 가중치)
4. **B02 admin today Realtime** (Supabase Realtime 30초 구독)
5. **tel: 딥링크** (전화번호 복호화 RPC + AES-GCM 서버키)
6. **관리자 역할 서버 결정** (admin_users.username + RPC)
7. **A05 결과 7종 확장** (customer_postponed → 분기 + customer_cancelled → A10)
8. **PWA 아이콘 에셋** (TD-008)

## 잔존 백로그 (R8+)

- A07 photos 의 EXIF 추출 + 자동 압축 (WebP)
- A10 photo_ids 자동 첨부 (cancellation_reports 통합)
- B03 ETL 업로드 화면 (CSV/XLSX/Sheets/Email)
- B04 기사 상세 + 신규 발급 화면
- B07 결제 링크 발송 (PortOne SDK)
- B11 정산 자동 CSV
- 사진 lifecycle (Hot → Warm 30일, R2 이관)
- pg_cron 본문 (Pro 전환 후)
- next-pwa Turbopack 호환 (Phase 2)
- 의존성 transitive 2건 모니터링
