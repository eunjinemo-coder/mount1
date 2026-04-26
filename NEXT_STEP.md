# Next Step

다음 세션 진입 시 바로 이어갈 작업. 3줄 원칙.

---

## 현재 상태 (2026-04-26 · commit dbb0ca6)

```
git: main @ dbb0ca6 (R7 + R8 누적 22+ commits)
검증: typecheck 6/6 ✓ · lint 6/6 ✓ · build 2/2 ✓
라우트: driver 14 + admin 11 = 25 라우트
와이어프레임 매칭률: ~90% (R7=85% → R8 = +5%)
보안 P0: 0건 · P1: 5건 (백로그)
시공 lifecycle: 모두 PASS · A02 일괄 + B05 추천 + Realtime + tel: 딥링크 모두 작동 가능
의존성: 2 moderate (uuid<14 / postcss<8.5.10) — Sentry/Next 패치 릴리즈 대기
```

## 다음 세션 진입 시 1단계 — 은진님 액션 (`_HANDOFF.md` 참조)

```bash
cd D:\MOUNT1 && git pull
supabase db push                           # 0005~0012 7개 마이그레이션 적용
pnpm --filter @mount/db db:types:dev       # types regenerate (RPC 6 + recommend 1 추가)
```

추가 (Dashboard 1회):
- Auth → Hooks → Custom Access Token Hook 활성화
- Storage → photos-hot · signatures · cls-reports-draft 3 버킷 생성
- Settings → Vault → `pii_key` secret 등록 (openssl rand -base64 32)
- SQL Editor → super_admin 발급 (HANDOFF #4 단일 do$$ 블록)

## R8 완료 항목 (이번 라운드)

1. ✅ Admin Realtime (orders/installations/issues postgres_changes 구독 + 60s fallback)
2. ✅ Driver shell pathname 자동 active tab (BottomNav use client 분리)
3. ✅ Driver next.config CSP dev/prod 분리 + Sentry region host 보강
4. ✅ tel: 딥링크 (PII 복호화 RPC + Vault 키 + Driver UI 전화 버튼)
5. ✅ B05 추천 점수 (Haversine + 등급 + 부하 + 선호 + 공정성)
6. ✅ A02 일괄 처리 탭 (표 + 다중 통화 일괄 기록)
7. ✅ Cancel 사진 자동 첨부 (photos 본인 + 본 order 자동 link)
8. ✅ _HANDOFF SQL 완전판 (super_admin + technician — aud + identities + NOT NULL 토큰)

## R9 후보 (다음 세션)

1. **/admin/accounts/new** — 협력기사 등록 + 자동 발급 화면 (super_admin)
2. **Kakao Maps SDK** — A02 지도 탭 + B06 admin live (외부 key 발급 후)
3. **A07 EXIF + WebP 자동 압축** — 사진 업로드 시 메타 추출 + lossy 변환
4. **B03 ETL 업로드 화면** — CSV/XLSX/Sheets/Email 4 모드
5. **B07 PortOne 결제 링크** — Webhook + 결제 상태 sync
6. **B11 정산 자동 CSV** — 주간 정산 export

## 잔존 백로그 (R10+)

- 사진 lifecycle (Hot → Warm 30일, R2 이관)
- pg_cron 본문 (prod Pro 전환 후 0003_cron 적용)
- next-pwa Turbopack 호환 (Phase 2)
- 관리자 IP whitelist 검증 (Phase 2)
- E2E 테스트 (Playwright + Vercel Browser)
- Sentry source map 업로드 (Auth Token 발급 후)
- Login server action debug log 정리 (P3)
