# 0002 — 예약시각 기사 직접 변경 / 1h 윈도우 / 본사 알림

**Status**: accepted (2026-05-06)

## Context

기존(v1)에는 `orders.scheduled_installation_at`을 본사 admin만 변경 가능했다 (`orders_update_admin` RLS만 존재). 기사는 시각 변경 시 카카오톡 채널 → 본사 수동 처리 동선.

v2에서 driver UX 단축 차원에서 **기사가 직접 변경 가능**하게 결정. 다만 위탁계약자 자율성과 본사 운영 통제 사이 균형 필요.

## Decision

**기사 본인이 자기 배차 주문의 `scheduled_installation_at`을 직접 UPDATE 가능. 단, 시작 1시간 전까지만**.
- **권한**: 신규 RLS 정책 `orders_update_technician_schedule` — `assigned_technician_id = technician_id() AND scheduled_installation_at - now() > interval '1 hour'` USING + WITH CHECK. column-level grant로 `scheduled_installation_at`만 UPDATE 허용.
- **알림 대상**: **본사 admin만** 자동 알림 (DB trigger → 알림 큐). 고객은 별도 알림 X — 시각 변경은 사전통화에서 합의된 결과를 driver UI에 반영하는 후행 액션이라 가정.
- **충돌 처리**: 시스템 차단 X. 기사가 변경 시 같은 시간대 본인 다른 시공이 있으면 폼에 경고 표시(N건). 결정은 기사 자율.
- **시작 1h 이내 변경**: RLS에 의해 차단 → 본사 카카오톡 채널로 fallback (현재 동선 유지).

## Considered alternatives

- **24시간 윈도우** (한국 서비스 표준 — 미용실/배달 등) — 우리는 짧은 시공(2~4h)이라 24h는 너무 보수적. 1h가 운영 현장과 맞음.
- **기사 변경 요청 → 본사 승인** — 운영 부담 ↑. 위탁계약자 자율성 정신과 충돌.
- **고객 SMS 자동 알림** — 사전통화에서 합의 가정이라 중복. 고객이 SMS·통화 양쪽 받으면 혼선. 합의 외 변경 케이스는 카카오톡 채널 처리.

## Consequences

- "왜 24h 표준 아닌 1h?"라는 후속 질문이 발생할 가능성 큼 — 이 ADR이 답변.
- 본사 admin 알림 채널 신규 (DB trigger → 알림 발송 — slack/email/admin 인앱 중 결정 R-next).
- 시작 1h 이내 변경은 카카오톡 channel 의존 — 자동화 없음 (의도적으로 break-glass 동선 유지).
- 본사 admin은 `orders_update_admin` 정책으로 시각 무제한 변경 가능 (기존 권한).
