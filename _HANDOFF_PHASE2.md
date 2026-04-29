# Phase 2 외부 서비스 가입 가이드 (R13~R14)

> 코드 framework 작성과 동시에 진행 가능. 모두 무료 tier 로 시작.

---

## 🟦 1. Kakao Developers — Maps SDK (A04 미니맵 + B06 실시간 지도)

**무료**: 일 300,000 호출 (충분).

### 가입 + 앱 등록 (5분)

1. 👉 https://developers.kakao.com/console/app
2. 카카오 계정으로 로그인
3. 우상단 **"애플리케이션 추가하기"** → 앱 이름 `마운트파트너스` → 회사명 `walltvpro` → 저장
4. 생성된 앱 클릭 → **"앱 키"** 화면
5. **"JavaScript 키"** 복사 (NEXT_PUBLIC 으로 클라에 노출됨, 도메인 등록으로 보호)

### Web 플랫폼 도메인 등록 (3분)

1. 좌측 메뉴 **"플랫폼"** → **Web** 클릭
2. 사이트 도메인 추가:
   - `http://localhost:3000` (driver dev)
   - `http://localhost:3001` (admin dev)
   - `https://app.mountpartners.cloud` (driver prod, DNS 후)
   - `https://admin.mountpartners.cloud` (admin prod, DNS 후)
3. 저장

### REST API 키 발급 (선택 — Geocoding 등)

같은 화면의 **"REST API 키"** 도 복사 (서버 사이드, 좌표 → 주소 변환 등에 사용).

### .env.local 양쪽 (admin + driver) 에 추가

```env
NEXT_PUBLIC_KAKAO_MAP_KEY=<JavaScript 키>
KAKAO_REST_API_KEY=<REST API 키 — 선택>
```

### 검증

dev 재시작 후 `/live` 진입 → 지도 로드 확인 (도메인 미등록 시 "Forbidden" 에러).

---

## 🟦 2. Upstash Redis — Rate Limiting

**무료**: 일 10,000 commands (충분).

### 가입 (3분)

1. 👉 https://upstash.com/
2. **"Login"** → GitHub 또는 Google 계정
3. 첫 가입 시 무료 플랜 자동 선택

### Redis 인스턴스 생성 (2분)

1. **"Create Database"** 클릭
2. 입력:
   - **Name**: `mount-rate-limit-prod` (또는 dev 따로)
   - **Type**: Regional
   - **Primary Region**: `ap-northeast-1` (Tokyo — 한국 가장 가까움)
   - **TLS**: enabled (default)
3. **Create**

### 키 복사

생성 후 화면에 표시:
- **UPSTASH_REDIS_REST_URL**: `https://xxxxx.upstash.io`
- **UPSTASH_REDIS_REST_TOKEN**: `AaaaXXX...`

### .env.local 양쪽에 추가

```env
UPSTASH_REDIS_REST_URL=https://xxxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AaaaXXX...
```

미설정 시 코드는 자동으로 in-memory rate limit 으로 fallback (dev 호환). prod 는 반드시 Upstash 권장.

---

## 🟦 3. IP Whitelist — admin_users 테이블 직접 입력 (DB 작업)

**외부 가입 불필요**. SQL Editor 에서 본인 IP 등록만.

### 본인 공인 IP 확인 (10초)

PowerShell 또는 cmd:
```cmd
curl https://api.ipify.org
```

또는 브라우저: https://api.ipify.org/

→ `123.45.67.89` 같은 IPv4 주소.

### Supabase SQL Editor 에서 등록

👉 https://supabase.com/dashboard/project/nzphbeookxotdjzishqn/sql/new

```sql
-- 본인 IP 1개 추가 (CIDR 형식 권장 — /32 = 단일 IP)
update admin_users
   set ip_whitelist = '["123.45.67.89/32"]'::jsonb
 where email = 'super_admin_eunjin@mountpartners.cloud';

-- 또는 여러 IP / 사무실 + 집
update admin_users
   set ip_whitelist = '["123.45.67.89/32", "10.0.0.0/24"]'::jsonb
 where email = 'super_admin_eunjin@mountpartners.cloud';

-- 임시로 검증 끄기 (모든 IP 허용 — 비권장, 운영 전 등록 권장)
update admin_users
   set ip_whitelist = '[]'::jsonb
 where email = 'super_admin_eunjin@mountpartners.cloud';
```

### 검증

- 등록한 IP 에서 admin 로그인 → 통과
- 다른 IP (모바일 데이터 등) 에서 시도 → 차단 메시지

⚠️ **운영 시작 전 모든 admin 계정에 IP 등록 권장**. 등록 안 하면 IP 검증 우회 (빈 배열 = 모든 IP 허용).

---

## 🟦 4. (선택) Cloudflare R2 — 사진 lifecycle (Hot → Warm → Cold)

**무료**: 10GB 저장 + 월 1M Class A operations.

현재 Supabase Storage `photos-hot` 만 사용. R2 이전은 Phase 2.

### 가입 + 버킷 생성 (5분)

1. 👉 https://dash.cloudflare.com/
2. 좌측 **R2** 클릭 → **"Create bucket"** 3개:
   - `mount-photos-hot` (사진 0~30일)
   - `mount-photos-warm` (30일~1년)
   - `mount-photos-cold` (1년+)
3. 각 버킷 → **Settings → CORS Policy** 추가:
   ```json
   [{
     "AllowedOrigins": ["https://app.mountpartners.cloud", "https://admin.mountpartners.cloud"],
     "AllowedMethods": ["GET", "PUT"],
     "AllowedHeaders": ["*"]
   }]
   ```

### API Token 발급

1. 우상단 **"Manage R2 API Tokens"** → **"Create API Token"**
2. Name: `mountpartners-app`
3. Permissions: **Admin Read & Write** (간소화 — 운영 시 read-only / write-only 분리)
4. 생성 → **Access Key ID + Secret + Account ID** 복사

### .env.local 추가

```env
R2_ACCOUNT_ID=xxxxx
R2_ACCESS_KEY_ID=xxxxx
R2_SECRET_ACCESS_KEY=xxxxx
R2_BUCKET_HOT=mount-photos-hot
R2_BUCKET_WARM=mount-photos-warm
R2_BUCKET_COLD=mount-photos-cold
```

운영 후 30일 지난 사진이 자동으로 Hot → Warm 이전되는 cron 은 Phase 2 작업.

---

## 📋 진행 순서 권장

| 순위 | 작업 | 소요 |
|---|---|---|
| 1 | Kakao Maps 가입 + 도메인 등록 | 8분 |
| 2 | IP whitelist 본인 IP 등록 | 1분 |
| 3 | Upstash Redis 가입 + 인스턴스 | 5분 |
| 4 | (운영 시작 후) R2 버킷 + API token | 별도 |

**1, 2번 끝나면 코드 변경 부분 즉시 작동**. 3은 Phase 2 운영 안정화 후.

---

## 🚦 진행 후 알려주세요

각 항목 끝나면:
- ✅ "Kakao Maps 키 .env 추가 완료"
- ✅ "IP whitelist 등록 완료, 본인 IP 123.45.67.89"
- ✅ "Upstash Redis URL + Token .env 추가"

→ 즉시 dev 재시작 + 검증 진행.
