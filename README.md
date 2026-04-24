# mountpartners

마운트파트너스 기사앱 + 관리자 웹. walltvpro 무타공 TV 시공 운영 SaaS.

## 구조

```
mountpartners/
├── apps/
│   ├── driver/     # 기사 PWA (Next.js 16) — app.mountpartners.cloud
│   └── admin/      # 관리자 웹 (Next.js 16) — admin.mountpartners.cloud
├── packages/
│   ├── ui/         # shadcn/ui 기반 공용 컴포넌트
│   ├── db/         # Supabase 클라이언트 + 타입
│   ├── config/     # ESLint · tsconfig · Tailwind · tokens.css
│   └── lib/        # 공용 유틸 (logger · feature-flag · 날짜 · 통화 등)
├── supabase/
│   ├── migrations/ # DDL 타임스탬프 prefix
│   ├── seed.sql
│   └── functions/  # Edge Functions
└── .env.example
```

## 개발

```bash
pnpm install
pnpm dev            # 두 앱 동시 (driver :3000, admin :3001)
pnpm dev:driver
pnpm dev:admin
pnpm typecheck
pnpm lint
pnpm build
```

## 참조 문서

- 기획: `D:\walltvprowiki\13_PROJECT_MANAGEMENT\MOUNTPARTNERS_APP\`
- 세션 헌법: `_FIRST_SESSION_PROMPT.md`
- 스캐폴딩 사양: `06_ROADMAP/05_SCAFFOLDING.md`
- 스택 결정: `05_TECH_STACK/01_STACK_DECISIONS.md`
- ERD: `02_IA/02_ERD.md`

## 라이선스

Proprietary. walltvpro (벽걸이프로) © 2026.
