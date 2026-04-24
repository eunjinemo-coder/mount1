# Risks

진행 중인 리스크와 완화 계획. 해소되면 `## 해소` 섹션으로 이동.

---

## 진행 중

### R-001 · 인프라 · 외부 서비스 키 발급 지연
- 원인: Supabase / R2 / Solapi / PortOne / Kakao / Sentry / PostHog 등 은진님 가입·인증 필요
- 영향: Step 4 Supabase migration 실행 및 양 앱 `pnpm build` 의 env-gated 분기 모두 막힘
- 완화: `_FIRST_SESSION_PROMPT §5.2` 체크리스트 순서대로 발급. `.env.example` 에 필요한 키 전부 명시 완료.
- 마감 희망: D-7 (2026-04-27)

### R-002 · 도구 · pnpm 10.x vs 기획서 9.x 불일치
- 원인: 스펙 작성 시점 10.x 미릴리스
- 영향: 기획서 글자 그대로 해석 시 재설치 압박
- 완화: `_DECISIONS.md` 기록 + `package.json#packageManager` 필드 고정
- 재검토: 팀 합류 시

### R-003 · 일정 · D-Day 2026-05-03 까지 9일 · 25k~35k LOC 목표
- 원인: 1인 스로우 상용화
- 영향: 품질 게이트 미달 위험 (헌법 제2·4·5·11조 타협 유혹)
- 완화: 매일 `typecheck`/`lint`/`build` 3종 초록 유지. 시간 박스(PART 8.1) 2배 초과 시 에스컬레이션.
- 체크 주기: 매 세션 종료

### R-004 · 호환성 · Next.js 16 + ESLint 9 flat config + eslint-config-next
- 원인: `eslint-config-next` flat config 지원 시점 불분명
- 영향: `next lint` 실행 시 legacy `.eslintrc` 요구 가능성
- 완화: 이번 세션은 루트 `eslint.config.mjs` 만 재사용. Step 5 CI/CD 단계에서 `@eslint/compat` 도입 또는 `eslint-config-next@16+` 확인.
- 상환: `TD-006`

### R-005 · 의존성 · 실제 패키지 레지스트리 버전
- 원인: 본 스캐폴드에 명시한 caret 버전 (`^16.0.0`, `^19.0.0`, `^9.18.0` 등) 이 실제 npm 레지스트리와 매칭되지 않을 가능성
- 영향: `pnpm install` 실패
- 완화: 설치 실패 시 최신 안정 버전 리졸브. 실패 로그는 `_DECISIONS.md` 업데이트.
- 점검: Task #7 (`pnpm install + typecheck/lint/build 증빙`)
