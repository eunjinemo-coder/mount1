# 시공 → 블로그 자산화 브릿지

시공 사진과 시공 정보를 **블로그 초안**으로 넘기는 다리. 시공을 할수록 콘텐츠가 쌓이게 만든다.

```
[시공 앱(클라우드)]  완료 + 사진 등록
        │  ① 대기건 조회(GET /api/blog/pending)
        ▼
[브릿지(은진님 PC)]  사진 내려받기 → 01_.jpg, 02_.jpg …
        │  ② 잡 생성(POST 127.0.0.1:8000/api/jobs/create → /generate)
        ▼
[blog-automation]   Vision + Claude 초안 → 검수 후 발행
        │  ③ 전달 완료 표시(POST /api/blog/pending)
        ▼
[시공 앱]           중복 생성 방지
```

**왜 PC에서 당겨오나**: 앱은 클라우드(Vercel), blog-automation은 로컬(127.0.0.1)이라 클라우드가 로컬을 부를 수 없다. 게다가 blog-automation API는 같은 PC(loopback)에서만 열린다.

---

## 개인정보 보호 (중요)

블로그는 공개면이라 앱이 **보내기 전에** 걸러낸다 (`apps/admin/lib/blog/payload.ts`, 테스트 20건):

| 항목 | 처리 |
|---|---|
| 성함 · 연락처 | **애초에 전송 안 함** (타입에 필드가 없음) |
| 주소 | **시/군/구까지만** — `경기 용인시 수지구 수지로 487 (동천마을…)` → `경기 용인시 수지구` |
| 아파트·단지명 | 제거 (위치가 특정되므로) |
| 특이사항 메모 | 이름·전화번호 마스킹 → `[고객] [연락처]` |
| 시공일자 | 제목엔 **월까지만** (`7월`) |
| 시공내용 · 사진 · 캡션 | 그대로 전달 (블로그 원료) |

---

## 1회 설정

### ① 앱(Vercel) 환경변수
`mount-admin` → Settings → Environment Variables:
```
BLOG_BRIDGE_TOKEN = <아무 긴 랜덤 문자열 (32자 이상)>
```
저장 후 **Redeploy**. (미설정이면 브릿지 API는 503으로 꺼져 있음)

### ② DB 마이그레이션
Supabase SQL Editor에 `supabase/migrations/0027_blog_export.sql` 실행.

### ③ 로컬 환경변수
```bash
set BLOG_BRIDGE_TOKEN=<위와 같은 값>
# 필요 시
set ADMIN_BASE=https://mount-admin.vercel.app
set BLOG_API=http://127.0.0.1:8000
set PHOTO_DIR=C:\Users\user\Desktop\bridge-photos
```

---

## 실행

blog-automation을 먼저 켠다 (`python run_web.py`). 그다음:

```bash
node docs/blog-bridge/bridge.mjs --dry       # 내용만 확인 (아무것도 안 만듦)
node docs/blog-bridge/bridge.mjs             # 잡 생성 + 초안 생성
node docs/blog-bridge/bridge.mjs --no-generate   # 잡만 만들고 초안은 화면에서
node docs/blog-bridge/bridge.mjs --limit 3
```

**처음엔 `--dry`로** 제목/메모가 어떻게 나가는지 눈으로 확인하고 돌리는 걸 권장.

---

## 동작 조건

브릿지가 가져가는 시공건 = **상태 완료** + **사진 1장 이상** + **아직 안 보낸 것**.
→ 사진 안 올린 시공은 대상이 아니다.

## 자주 겪는 것

| 증상 | 원인/해결 |
|---|---|
| `앱 인증 실패` | 로컬 `BLOG_BRIDGE_TOKEN` ≠ Vercel 값. 재배포했는지도 확인 |
| `기능 꺼짐(503)` | Vercel에 `BLOG_BRIDGE_TOKEN` 미설정 |
| `보낼 시공건이 없습니다` | 완료 상태 + 사진 등록 여부 확인 |
| 잡 생성 실패(연결 거부) | blog-automation(`run_web.py`)이 안 켜져 있음 |
| 초안 생성 실패 | 잡은 생성됨 → blog-automation 화면에서 재시도 |

## 알아둘 것

- 초안 생성(`/generate`)은 blog-automation 설정에 따라 **네이버 임시저장까지** 이어질 수 있다. 초안만 원하면 `--no-generate`로 만들고 화면에서 진행.
- 사진 순서는 파일명(`01_`, `02_`…)으로 고정되고, **캡션 문구 자체는 Vision이 새로 만든다**(앱 캡션은 site_note에 힌트로 전달).
