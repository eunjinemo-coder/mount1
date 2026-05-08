# 0001 — driver 워크플로 단축 / Status 머신 단일 점프

**Status**: accepted (2026-05-06)

## Context

기존 driver 워크플로(v1)는 [출발] → en_route → [현장 도착] → on_site → [시공 시작] → in_progress → [완료] → no_drill_completed 4-단계 transition을 거쳤다. admin /live 페이지가 `LIVE_DASHBOARD_STATUSES = [assigned, en_route, on_site, in_progress]`로 기사의 실시간 위치를 추적했다.

운영 인터뷰에서 "본사가 기사 위치를 실시간으로 알 필요는 없다"는 결정이 나왔고, 동시에 driver UX 단축 요구가 강했다 ("기사는 그냥 현장에서 작업 다 하고 사진 찍어놓고 차로 내려와서 [완료] 누르고 사진업로드하고 메모 작성해서 완료제출").

## Decision

**driver 흐름은 `assigned → no_drill_completed`(또는 `drill_converted_completed`) 단일 점프**.
- `en_route` / `on_site` / `in_progress` 3개 status는 **driver 흐름에서 deprecated**. enum에서 즉시 제거하지는 않되(쿠팡 측 데이터·과거 시공 이력에 남음) 신규 주문은 거치지 않음.
- driver UI는 [완료] 버튼 1개만 노출 — 클릭 → /photos → /complete → atomic RPC `complete_install_atomic` 호출.
- admin /live 페이지의 `LIVE_DASHBOARD_STATUSES` 사용은 유지하되 `IN_PROGRESS_ORDER_STATUSES` 그룹은 신규 주문에서 거의 비어 있음 (재정의 또는 향후 deprecate 검토).
- photos INSERT RLS는 `on_site`/`in_progress` 외에 `assigned`도 허용하도록 완화.

## Considered alternatives

- **자동 status 추론** (사진 업로드 시점에 in_progress 자동 부여) — RLS 변경 필요는 동일. 의미는 보존되지만 `in_progress`의 의미가 "시공 중" → "사진 업로드 중"으로 미묘하게 변질되어 향후 헷갈림.
- **GPS / 시간 기반 자동 추적** — PWA 위치 권한 + 정확도 제약 + R-next+2 비용. 본사가 위치 추적 불필요 결정으로 보류.

## Consequences

- driver UX 일관성 ↑ — 기사가 매 transition마다 화면 보고 누를 필요 X. 한 손/이동 컨텍스트에서 부담 ↓.
- admin 운영 가시성 ↓ — "지금 김기사가 어디에 있는지" 실시간 추적 불가. 본사가 고객 문의 응대 시 "현장 도착했어요?" 답변 X. 본사 결정으로 수용.
- enum 18개 status 중 3개 (en_route, on_site, in_progress) deprecated 상태 — 향후 enum 정리 시점에 ADR 후속.
- `complete_install_atomic` RPC 도입 — 0016_rpc_cancel_atomic 패턴과 일치.
