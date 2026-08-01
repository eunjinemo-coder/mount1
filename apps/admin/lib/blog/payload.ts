/**
 * 시공건 → 블로그 초안 페이로드 (순수 · 단위 테스트 대상).
 *
 * 목적: 시공 사진 + 시공 메타를 blog-automation 이 소비할 수 있는 형태로 정규화한다.
 * B엔진(자사 시공 운영)의 부산물을 C엔진(블로그 콘텐츠)의 원료로 바꾸는 다리.
 *
 * ── ⚠ PII 금지선 (이 모듈의 존재 이유) ─────────────────────────────────────────
 *   블로그는 공개면이다. 고객 성함·연락처·상세주소(동/호수)는 절대 페이로드에 넣지 않는다.
 *   주소는 "시/군/구"까지만 추출한다(예: "경기 용인시 수지구 수지로 487 (동천동,…)" → "경기 용인시 수지구").
 *   설치내용/특이사항은 운영 메모라 전화번호·이름이 섞일 수 있어 마스킹 후 통과시킨다.
 */

/** 블로그 초안 생성에 넘기는 안전한 페이로드. */
export interface BlogDraftPayload {
  /** 시공건 식별자(중복 생성 방지·추적용. 공개 본문에는 쓰지 않음). */
  jobId: string;
  /** 시공 지역 — 시/도 + 시군구 까지만(공개 안전). 추출 실패 시 null. */
  region: string | null;
  /** 시공일자 YYYY-MM-DD(공개 시 월 단위로 쓸지는 소비측 판단). */
  installedOn: string | null;
  /** 설치 타입(예: 무타공/타공). */
  installType: string | null;
  /** 설치내용 원문(마스킹 적용). 예: 삼성65"설치12 정품10 게임기2 */
  installContent: string | null;
  /** 특이사항(마스킹 적용) — 현장 팁이 블로그 소재가 됨. */
  notes: string | null;
  /** 사진 — 순서대로. url 은 시간제한 서명 URL(다운로드 후 사용). */
  photos: { url: string; caption: string | null }[];
}

/** 시/도 명칭(축약형 포함) — 주소 첫 토큰 매칭용. */
const PROVINCES = [
  '서울특별시', '서울시', '서울',
  '부산광역시', '부산시', '부산',
  '대구광역시', '대구시', '대구',
  '인천광역시', '인천시', '인천',
  '광주광역시', '광주시', '광주',
  '대전광역시', '대전시', '대전',
  '울산광역시', '울산시', '울산',
  '세종특별자치시', '세종시', '세종',
  '경기도', '경기',
  '강원특별자치도', '강원도', '강원',
  '충청북도', '충북', '충청남도', '충남',
  '전북특별자치도', '전라북도', '전북', '전라남도', '전남',
  '경상북도', '경북', '경상남도', '경남',
  '제주특별자치도', '제주도', '제주',
] as const;

/**
 * 주소 원문 → 공개 안전한 지역 문자열(시/도 + 시군구[+ 자치구]).
 * 예) "경기 용인시 수지구 수지로 487 (동천동, …)" → "경기 용인시 수지구"
 *     "서울 강남구 테헤란로 1"                    → "서울 강남구"
 *     "덕양구 지축로 55"(시/도 없음)              → "덕양구"
 * 도로명·번지·상세(괄호/동호수)는 모두 버린다. 실패 시 null.
 */
export function extractRegion(address: string | null | undefined): string | null {
  if (!address) return null;
  // 괄호 이후(법정동·아파트명 등)는 버린다 — 단지명이 곧 위치 특정이라 공개 리스크.
  const head = address.split('(')[0] ?? '';
  const tokens = head.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  const out: string[] = [];
  let i = 0;
  if (PROVINCES.includes(tokens[0] as (typeof PROVINCES)[number])) {
    out.push(tokens[0]!);
    i = 1;
  }
  // 시/군/구 토큰을 최대 2개까지(예: "용인시 수지구")
  for (; i < tokens.length && out.length < 3; i += 1) {
    const t = tokens[i]!;
    if (/(시|군|구)$/.test(t)) out.push(t);
    else break; // 도로명 시작 → 중단
  }
  return out.length > 0 ? out.join(' ') : null;
}

/**
 * 운영 메모의 개인정보 마스킹 — 전화번호·이름(성함 표기)을 지운다.
 * 블로그 소재로 쓰되 사람이 특정되지 않게. 완전 제거가 아니라 보수적 치환(원문 맥락 보존).
 */
export function maskPersonal(text: string | null | undefined): string | null {
  if (!text) return null;
  let out = text;
  // 전화번호(010-1234-5678 · 01012345678 · 02-333-4444 등)
  out = out.replace(/\b0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}\b/g, '[연락처]');
  // 이름+호칭(은진님 시트 실표기: "신미나누나", "홍길동님" 등).
  // (?![가-힣]) 로 뒤에 한글이 이어지면 제외 — "무타공 형태"의 '형' 오탐 방지.
  out = out.replace(
    /[가-힣]{2,4}\s*(고객님|사장님|대표님|형님|누나|언니|오빠|이모|삼촌|님|씨|형)(?![가-힣])/g,
    '[고객]',
  );
  const trimmed = out.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * blog-automation(`POST /api/jobs/create`) 입력 형태.
 * 그쪽은 제품명·지역 전용 필드가 없고 **title + site_note 두 슬롯에 자연어로 인코딩**하는 설계다.
 * 특히 Vision 프롬프트가 "지역/건물명은 title 에 있을 때만 사용(사진에서 추론 금지)"이라
 * 지역은 반드시 title 에 들어가야 한다.
 */
export interface BlogJobRequest {
  content_type: 'case_study';
  title: string;
  site_note: string;
  /** 로컬 절대경로 — 브릿지가 사진을 내려받은 뒤 채운다(정렬은 파일명 사전순). */
  images: string[];
}

/** "2026-07-30" → "7월" (공개 본문에 일자까지 노출할 필요 없음). */
function monthLabel(iso: string | null): string | null {
  if (!iso) return null;
  const m = /^\d{4}-(\d{2})-\d{2}$/.exec(iso);
  return m ? `${Number(m[1])}월` : null;
}

/**
 * 페이로드 → 블로그 잡 제목. 지역이 핵심(Vision 규약) + 시공 유형/내용 요약.
 * 예: "경기 용인시 수지구 무타공 벽걸이TV 설치 — 삼성65\" (7월)"
 */
export function buildBlogTitle(p: BlogDraftPayload): string {
  const parts: string[] = [];
  if (p.region) parts.push(p.region);
  if (p.installType) parts.push(p.installType);
  parts.push('벽걸이TV 설치');
  const head = parts.join(' ');
  const tail: string[] = [];
  if (p.installContent) tail.push(p.installContent);
  const month = monthLabel(p.installedOn);
  if (month) tail.push(`(${month})`);
  return tail.length > 0 ? `${head} — ${tail.join(' ')}` : head;
}

/**
 * 페이로드 → site_note(운영자 메모 블록). 생성기가 본문 재료로 쓴다.
 * 캡션 지정 API 가 없으므로(Vision 이 캡션 생성) 사진 설명은 여기에 순서대로 힌트로 넣는다.
 * 4000자 제한이 있어 여유 있게 자른다.
 */
export function buildBlogSiteNote(p: BlogDraftPayload): string {
  const lines: string[] = [];
  if (p.region) lines.push(`시공 지역: ${p.region}`);
  if (p.installType) lines.push(`설치 유형: ${p.installType}`);
  if (p.installContent) lines.push(`시공 내용: ${p.installContent}`);
  if (p.notes) lines.push(`현장 특이사항: ${p.notes}`);
  const captions = p.photos.map((ph, i) => (ph.caption ? `${i + 1}. ${ph.caption}` : null)).filter(Boolean);
  if (captions.length > 0) lines.push(`사진 설명(순서대로):\n${captions.join('\n')}`);
  return lines.join('\n').slice(0, 3800);
}

/** 페이로드 → blog-automation 잡 요청(이미지 경로는 브릿지가 채움). */
export function toBlogJobRequest(p: BlogDraftPayload): Omit<BlogJobRequest, 'images'> {
  return {
    content_type: 'case_study',
    title: buildBlogTitle(p),
    site_note: buildBlogSiteNote(p),
  };
}

export interface BuildPayloadInput {
  jobId: string;
  scheduledInstallDate: string | null;
  address: string | null;
  installType: string | null;
  installContent: string | null;
  specialNotes: string | null;
  photos: { url: string; caption: string | null }[];
}

/** 시공건 + 사진 → 공개 안전 페이로드. PII(성함·연락처·상세주소)는 애초에 받지 않는다. */
export function buildBlogDraftPayload(input: BuildPayloadInput): BlogDraftPayload {
  return {
    jobId: input.jobId,
    region: extractRegion(input.address),
    installedOn: input.scheduledInstallDate ? input.scheduledInstallDate.slice(0, 10) : null,
    installType: input.installType?.trim() || null,
    installContent: maskPersonal(input.installContent),
    notes: maskPersonal(input.specialNotes),
    photos: input.photos.map((p) => ({ url: p.url, caption: maskPersonal(p.caption) })),
  };
}
