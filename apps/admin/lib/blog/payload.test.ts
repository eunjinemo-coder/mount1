import { describe, expect, it } from 'vitest';
import {
  buildBlogDraftPayload,
  buildBlogSiteNote,
  buildBlogTitle,
  extractRegion,
  maskPersonal,
  toBlogJobRequest,
} from './payload';

describe('extractRegion — 공개 안전 지역만 추출', () => {
  it('시/도 + 시 + 구 (은진님 실제 주소 형태)', () => {
    expect(extractRegion('경기 용인시 수지구 수지로 487 (동천동, 동천마을현대홈타운아파트)')).toBe(
      '경기 용인시 수지구',
    );
  });
  it('시/도 + 구', () => {
    expect(extractRegion('서울 강남구 테헤란로 1')).toBe('서울 강남구');
    expect(extractRegion('서울특별시 송파구 올림픽로 300')).toBe('서울특별시 송파구');
  });
  it('시/도 없이 시작해도 시군구는 잡는다', () => {
    expect(extractRegion('덕양구 지축로 55 (지축동, 지축역 센트럴 푸르지오)')).toBe('덕양구');
  });
  it('도로명·번지·상세주소는 절대 포함하지 않는다', () => {
    const r = extractRegion('경기 의정부시 문화로38');
    expect(r).toBe('경기 의정부시');
    expect(r).not.toContain('문화로');
    expect(r).not.toContain('38');
  });
  it('아파트/단지명(괄호 뒤)은 버린다 — 단지명은 위치 특정 리스크', () => {
    expect(extractRegion('인천 미추홀구 제물포 (숭의동, 이편한세상)')).not.toContain('이편한세상');
  });
  it('빈값/파싱불가 → null', () => {
    expect(extractRegion(null)).toBeNull();
    expect(extractRegion('')).toBeNull();
    expect(extractRegion('수자인 10동')).toBeNull(); // 시군구 없음
  });
});

describe('maskPersonal — 메모 속 개인정보 마스킹', () => {
  it('전화번호 형식들을 가린다', () => {
    expect(maskPersonal('린파 철거 010-2701-3914 연락')).toBe('린파 철거 [연락처] 연락');
    expect(maskPersonal('01041563478 로 전화')).toBe('[연락처] 로 전화');
    expect(maskPersonal('02-333-4444 사무실')).toBe('[연락처] 사무실');
  });
  it('이름+호칭을 가린다', () => {
    expect(maskPersonal('홍길동님 요청사항')).toBe('[고객] 요청사항');
    expect(maskPersonal('신미나 누나 집')).toContain('[고객]');
  });
  it('시공 내용 자체는 보존한다(블로그 소재)', () => {
    expect(maskPersonal('삼성65"설치12 정품10 게임기2')).toBe('삼성65"설치12 정품10 게임기2');
  });
  it('호칭처럼 보이는 일반어는 오탐하지 않는다', () => {
    expect(maskPersonal('무타공 형태로 시공')).toBe('무타공 형태로 시공');
    expect(maskPersonal('벽걸이 브라켓 씨리즈')).toBe('벽걸이 브라켓 씨리즈');
  });
  it('빈값 → null', () => {
    expect(maskPersonal(null)).toBeNull();
    expect(maskPersonal('   ')).toBeNull();
  });
});

describe('buildBlogDraftPayload — PII 금지선', () => {
  const INPUT = {
    jobId: 'job-1',
    scheduledInstallDate: '2026-07-30',
    address: '경기 용인시 수지구 수지로 487 (동천동, 동천마을현대홈타운아파트)',
    installType: '무타공',
    installContent: '삼성65" 벽걸이 설치',
    specialNotes: '홍길동님 010-1234-5678 로 도착 전 연락',
    photos: [{ url: 'https://signed/1.jpg', caption: '설치 완료 정면' }],
  };

  it('지역만 남고 상세주소·단지명은 사라진다', () => {
    const p = buildBlogDraftPayload(INPUT);
    expect(p.region).toBe('경기 용인시 수지구');
    expect(JSON.stringify(p)).not.toContain('수지로 487');
    expect(JSON.stringify(p)).not.toContain('동천마을');
  });

  it('메모의 이름·연락처가 페이로드에 남지 않는다', () => {
    const s = JSON.stringify(buildBlogDraftPayload(INPUT));
    expect(s).not.toContain('홍길동');
    expect(s).not.toContain('010-1234-5678');
  });

  it('시공 내용·사진·캡션은 그대로 전달(블로그 원료)', () => {
    const p = buildBlogDraftPayload(INPUT);
    expect(p.installType).toBe('무타공');
    expect(p.installContent).toBe('삼성65" 벽걸이 설치');
    expect(p.installedOn).toBe('2026-07-30');
    expect(p.photos).toEqual([{ url: 'https://signed/1.jpg', caption: '설치 완료 정면' }]);
  });

  it('성함·연락처 필드는 애초에 입력받지 않는다(구조적 차단)', () => {
    // BuildPayloadInput 에 customer_name/phone 이 없다 — 타입 레벨 금지선.
    const keys = Object.keys(buildBlogDraftPayload(INPUT));
    expect(keys).not.toContain('customerName');
    expect(keys).not.toContain('phone');
  });

  describe('blog-automation 잡 변환 (title + site_note 슬롯)', () => {
    const P = buildBlogDraftPayload(INPUT);

    it('title 에 지역이 반드시 들어간다 (Vision 은 사진에서 지역 추론 안 함)', () => {
      const t = buildBlogTitle(P);
      expect(t).toContain('경기 용인시 수지구');
      expect(t).toContain('무타공');
      expect(t).toContain('벽걸이TV 설치');
      expect(t).toContain('7월'); // 일자까지는 노출 안 함
      expect(t).not.toContain('30'); // 일(day) 비노출
    });

    it('site_note 에 시공 재료 + 사진 설명(순서)이 담긴다', () => {
      const n = buildBlogSiteNote(P);
      expect(n).toContain('시공 지역: 경기 용인시 수지구');
      expect(n).toContain('설치 유형: 무타공');
      expect(n).toContain('시공 내용: 삼성65" 벽걸이 설치');
      expect(n).toContain('1. 설치 완료 정면');
    });

    it('변환 결과에도 PII 가 새지 않는다', () => {
      const s = JSON.stringify(toBlogJobRequest(P));
      expect(s).not.toContain('홍길동');
      expect(s).not.toContain('010-1234-5678');
      expect(s).not.toContain('수지로 487');
      expect(s).not.toContain('동천마을');
    });

    it('content_type 은 case_study 고정(허용값)', () => {
      expect(toBlogJobRequest(P).content_type).toBe('case_study');
    });

    it('지역 없으면 제목이 깨지지 않고 일반 제목이 된다', () => {
      const t = buildBlogTitle(buildBlogDraftPayload({ ...INPUT, address: null }));
      expect(t).toContain('벽걸이TV 설치');
      expect(t.startsWith('—')).toBe(false);
    });
  });
});
