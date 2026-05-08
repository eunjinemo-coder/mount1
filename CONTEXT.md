# MountPartners (마운트파트너스)

협력기사가 쿠팡 무타공 TV 시공 주문을 처리하는 운영 시스템. driver(기사) / admin(본사) 두 surface가 같은 도메인 모델을 공유한다.

## Language

### 워크플로 핵심

**사전통화 (pre-call)**:
배차된 시공 약 30분 전 기사가 고객에게 거는 통화 *시도 행위*. outcome (통화완료·부재중·연결안됨·통화중·고객연기 등) 무관, 통화 시도 결과를 저장하는 것 자체가 "사전통화 = 완료" 의미.
_Avoid_: "사전 연락" (이건 통화 외 SMS·카톡 포함될 수 있어 모호)

**완료 (driver UI 라벨 "[완료]")**:
기사가 현장에서 시공 작업을 마치고 차로 내려와서 사진 업로드·메모 단계로 진입할 때 누르는 버튼. backend status는 [완료] 클릭 → /photos → /complete 제출까지 거쳐 `no_drill_completed` 또는 `drill_converted_completed`로 단일 점프.
_Avoid_: "시공 시작", "출발" (기사 멘탈 모델은 시공이 이미 끝난 상태)

**무타공 시공**:
TV 벽걸이 설치를 *벽에 구멍을 뚫지 않고* 자체 브라켓으로 마치는 시공. 사양상 99%의 시공이 무타공으로 종료된다. backend `no_drill_completed`.

**타공 전환**:
현장에서 무타공 불가 판정 후 *고객 합의 하에* 타공 시공으로 변경. 정산 차액(brackets/공임)이 별도 계산된다. backend `drill_converted_completed` + `conversion_from_no_drill = true`. 드물게 발생.
_Avoid_: "타공" (시공 종류가 아니라 *전환*된 결과 — 처음부터 타공이면 별개 카테고리)

**이슈 (issue)**:
시공 진행 중 보고되는 상황 알림. 시공 *가능* 가정 — 시공 자체가 차단된 경우는 이슈가 아니라 [취소]. 6 카테고리(고객 부재 / TV 불일치 / 접근 불가 / 벽 손상 / 무타공 불가 / 기타) + 자유 메모. driver 작성 → admin 응답(1:1, `admin_response_text`).

**취소 (cancellation)**:
현장에서 시공 자체가 *불가능*하다고 판정해 보고하는 별도 절차. `cancellation_reports` 테이블, `cancel_requested` → `cancel_confirmed_coupang_transfer` status 분기. 진입은 driver 개요 화면 footer danger zone 텍스트 링크.
_Avoid_: "이슈"와 헷갈림 — 이슈는 시공 계속, 취소는 시공 중단. 카테고리 일부 겹쳐도 의미 다름.

**진행현황 (progress indicators)**:
driver 주문 상세 개요에 자동 표시되는 3개 인디케이터 — 사전통화 ✓ / 시공전 사진 N/2 / 완료 사진 N/3. 기사가 별도 액션 X — 통화 저장·사진 INSERT 시점에 자동 갱신.

**타임스탬프 사진**:
타임스탬프 카메라 앱(시각·좌표 워터마크)으로 미리 촬영해 갤러리에 보관 → 차에서 /photos로 업로드. 운영 안전 보조 장치 — 사진 위변조 방지 + EXIF 비의존 검증.
_Avoid_: 단순 "갤러리 사진" — 타임스탬프 워터마크가 없으면 본사 검수 시 reject 가능.

### 권한·식별

**기사 (technician)**:
협력 위탁계약자. 본인이 배차된 주문만 read/write 가능. RLS 정책으로 `assigned_technician_id = technician_id()` 제약.
_Avoid_: "기사님"(driver UI 표시용 호칭) — 도메인 코드에서는 "기사".

**본사 admin**:
ops_admin / cs_admin / super_admin 3 역할. 모든 주문에 read 권한 + role별 write 권한 분리. 기사 주문 변경에 대한 알림 수신 주체.

## Relationships

- 한 **주문**은 한 **기사**에게 배정된다 (`assigned_technician_id`)
- 한 **주문**은 0 또는 1개의 **취소** 보고를 가진다 (`cancellation_reports` 1:1)
- 한 **주문**은 N개의 **이슈**를 가진다 (`issues` 1:N)
- 한 **이슈**는 0 또는 1개의 **본사 응답**을 가진다 (`admin_response_text`, 1:1 컬럼)
- 한 **주문**은 N개의 **사진**을 가진다 — 슬롯 5개(pre_tv_screen / pre_wall / post_front / post_left / post_right) + EXTRA
- **사전통화**는 `call_logs.type='pre_arrival_30min'` row 존재 여부로 판정 — outcome 무관

## Example dialogue

> **개발자**: "기사가 [완료] 누르면 backend status가 어떻게 돼요? `in_progress` 거치나요?"
> **도메인 전문가**: "v2부턴 안 거쳐요. assigned에서 바로 `no_drill_completed`로 점프. 99%는 무타공 결말이고, 현장에서 타공으로 전환된 경우만 `drill_converted_completed`. en_route/on_site/in_progress 상태들은 사용 안 해요."
>
> **개발자**: "사전통화 ✓ 인디케이터는 통화 성공인 경우만이죠?"
> **도메인 전문가**: "아니요. 부재중·연결안됨도 다 ✓예요. 사전통화는 *시도 행위*를 말해요 — 시도 기록 자체가 의미. 통화 성공 여부는 별도 outcome 데이터로 봐요."
>
> **개발자**: "타임스탬프 사진이 EXIF랑 다른 게 뭐예요?"
> **도메인 전문가**: "EXIF는 메타데이터라 변조 가능하지만 타임스탬프 앱 사진은 *이미지 위에 시각·좌표가 워터마크로 박혀요*. 갤러리에서 다른 시공 사진 골라 올리면 워터마크 시각이 안 맞아 본사 검수에서 잡혀요."

## Flagged ambiguities

- "시공 시작" vs "[완료]"는 둘 다 시공으로 들어가는 시점이지만 의미가 정반대 — 해소: driver UI에는 [완료]만 노출, 시공 시작 단계는 기사가 앱 밖에서 진행 (status는 `assigned` 그대로).
- "사진 업로드 완료"는 두 가지 의미 — ① /photos 슬롯 5장 모두 INSERT (사용자 시점) ② 차량 이동 후 자유 시간에 사진 정리·메모 마무리 (워크플로 시점). UI는 ①만 다룸 — 미충족(부분 업로드 + 메모 사유)도 허용.
