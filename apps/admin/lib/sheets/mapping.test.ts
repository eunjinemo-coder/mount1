import { describe, expect, it } from 'vitest';
import {
  buildInstallationWrite,
  checkSyncIdOverlap,
  DEFAULT_INSTALLATION_COLUMN_MAP,
  DEFAULT_INSTALLATION_SYNC_ID_COLUMN,
  hasMinimalForCreate,
  isoToSheetDate,
  isValidIsoDate,
  parseSheetDateToIso,
  toFields,
  type InstallationJobRow,
} from './mapping';

const ROW: InstallationJobRow = {
  id: 'j1',
  scheduled_install_date: '2026-07-10',
  received_date: '2026-07-01',
  move_date: '2026-07-08',
  visit_time: '오전',
  technician_name: '김기사',
  customer_phone: '010-1234-5678',
  customer_phone2: '집 02-333-4444',
  address: '서울 강남구 …',
  address_detail: '101동 1001호',
  customer_name: '홍길동',
  install_type: '벽걸이',
  install_content: '55인치 무타공',
  special_notes: '문 앞 배송',
  updated_at: '2026-07-09T00:00:00.000Z',
};

describe('toFields — installation_jobs → 시트 매핑필드(읽기 투영)', () => {
  it('13필드 매핑 + 날짜 시트표기(YYYY. M. D · 선행0 없음)', () => {
    const f = toFields(ROW);
    expect(f.scheduled_install_date).toBe('2026. 7. 10');
    expect(f.received_date).toBe('2026. 7. 1');
    expect(f.move_date).toBe('2026. 7. 8');
    expect(f.visit_time).toBe('오전');
    expect(f.technician_name).toBe('김기사');
    expect(f.customer_contact).toBe('010-1234-5678'); // 원문 보존(전화정규화 안 함)
    expect(f.customer_contact2).toBe('집 02-333-4444');
    expect(f.customer_name).toBe('홍길동');
    expect(f.install_content).toBe('55인치 무타공');
    expect(f.special_notes).toBe('문 앞 배송');
  });

  it('status 는 시트 매핑필드에 포함하지 않는다(앱 내부)', () => {
    const f = toFields(ROW);
    expect(f.status).toBeUndefined();
  });

  it('null 필드는 제외', () => {
    const f = toFields({ ...ROW, special_notes: null, customer_phone2: null, move_date: null });
    expect(f.special_notes).toBeUndefined();
    expect(f.customer_contact2).toBeUndefined();
    expect(f.move_date).toBeUndefined();
  });

  it('date 가 timestamptz 형태로 와도 앞 10자→시트표기로 정규화(왕복 정합)', () => {
    const f = toFields({ ...ROW, scheduled_install_date: '2026-07-10T00:00:00.000Z' });
    expect(f.scheduled_install_date).toBe('2026. 7. 10');
  });
});

describe('시트 날짜 형식 변환 (은진님 시트 = "YYYY. M. D")', () => {
  it('parseSheetDateToIso — 은진님 형식/ISO/구분자 변형을 ISO 로', () => {
    expect(parseSheetDateToIso('2025. 3. 1')).toBe('2025-03-01'); // 점 뒤 공백
    expect(parseSheetDateToIso('2025. 3. 1.')).toBe('2025-03-01'); // 후행점
    expect(parseSheetDateToIso('2026.7.30')).toBe('2026-07-30');
    expect(parseSheetDateToIso('2026-07-30')).toBe('2026-07-30'); // 이미 ISO
    expect(parseSheetDateToIso('2026/7/30')).toBe('2026-07-30');
    expect(parseSheetDateToIso('7-10')).toBeNull(); // 연도 없음
    expect(parseSheetDateToIso('미정')).toBeNull();
  });

  it('isoToSheetDate — ISO → 은진님 표기(선행0 제거)', () => {
    expect(isoToSheetDate('2026-07-30')).toBe('2026. 7. 30');
    expect(isoToSheetDate('2025-03-01')).toBe('2025. 3. 1');
  });

  it('왕복 정합: ISO→시트→ISO', () => {
    const iso = '2026-07-05';
    expect(parseSheetDateToIso(isoToSheetDate(iso))).toBe(iso);
  });

  it('buildInstallationWrite — 시트표기 날짜를 DB용 ISO 로 역변환', () => {
    expect(buildInstallationWrite({ scheduled_install_date: '2025. 3. 1' }).scheduled_install_date).toBe(
      '2025-03-01',
    );
  });
});

describe('isValidIsoDate', () => {
  it('유효/무효 판정', () => {
    expect(isValidIsoDate('2026-07-10')).toBe(true);
    expect(isValidIsoDate('2026-02-30')).toBe(false); // 실재하지 않는 날짜
    expect(isValidIsoDate('2026/07/10')).toBe(false);
    expect(isValidIsoDate('미정')).toBe(false);
  });
});

describe('hasMinimalForCreate — 신규 생성 가드', () => {
  it('시공일자만 있어도 생성 가능', () => {
    expect(hasMinimalForCreate({ scheduled_install_date: '2026-07-10' })).toBe(true);
  });
  it('성함만 있어도 생성 가능', () => {
    expect(hasMinimalForCreate({ customer_name: '홍길동' })).toBe(true);
  });
  it('둘 다 없으면 생성 불가', () => {
    expect(hasMinimalForCreate({ visit_time: '오전', install_type: '벽걸이' })).toBe(false);
  });
  it('오형식 날짜는 요건 미충족(성함도 없으면 불가)', () => {
    expect(hasMinimalForCreate({ scheduled_install_date: '미정' })).toBe(false);
  });
});

describe('buildInstallationWrite — 매핑필드 → DB 쓰기객체', () => {
  it('필드키를 DB 컬럼으로(연락처 키 상이) 매핑', () => {
    const w = buildInstallationWrite({
      customer_name: '홍길동',
      customer_contact: '010-1234-5678',
      customer_contact2: '남편 010-9999-0000',
      visit_time: '14:00',
    });
    expect(w.customer_name).toBe('홍길동');
    expect(w.customer_phone).toBe('010-1234-5678');
    expect(w.customer_phone2).toBe('남편 010-9999-0000');
    expect(w.visit_time).toBe('14:00');
  });

  it('유효 날짜만 반영 · 오형식/빈 날짜는 skip(date 컬럼 오염 차단)', () => {
    expect(buildInstallationWrite({ scheduled_install_date: '2026-07-10' }).scheduled_install_date).toBe(
      '2026-07-10',
    );
    expect(buildInstallationWrite({ scheduled_install_date: '미정' })).toEqual({});
    expect(buildInstallationWrite({ scheduled_install_date: '' })).toEqual({});
  });

  it('status/미지원 키는 제외(시트 미동기화·오염 차단)', () => {
    const w = buildInstallationWrite({
      customer_name: '홍길동',
      status: 'completed',
      made_up_field: 'x',
    } as Record<string, string>);
    expect(w).toEqual({ customer_name: '홍길동' });
  });

  it('빈 문자열 텍스트는 그대로 반영(칸 비우기 허용)', () => {
    expect(buildInstallationWrite({ special_notes: '' })).toEqual({ special_notes: '' });
  });
});

describe('checkSyncIdOverlap — _sync_id 열 ↔ 데이터 열 충돌 가드', () => {
  it('기본 sync_id 열(AI)은 기본 매핑(A~M)과 겹치지 않는다', () => {
    expect(
      checkSyncIdOverlap(DEFAULT_INSTALLATION_SYNC_ID_COLUMN, DEFAULT_INSTALLATION_COLUMN_MAP),
    ).toBeNull();
  });

  it('sync_id 열이 데이터 열과 겹치면 한글 에러(예: 데이터열 A)', () => {
    const err = checkSyncIdOverlap('A', DEFAULT_INSTALLATION_COLUMN_MAP);
    expect(err).not.toBeNull();
    expect(err).toContain('겹칩니다');
    expect(err).toContain(DEFAULT_INSTALLATION_SYNC_ID_COLUMN); // 안내 열(AI) 포함
  });

  it("과거 위험 기본값(A/P)이 은진님 데이터열과 겹치는지 회귀 확인", () => {
    // A=시공일자, P 도 데이터열이면 겹침 — 겹칠 때 반드시 거부되어야 한다.
    expect(checkSyncIdOverlap('A', { A: 'scheduled_install_date' })).not.toBeNull();
    expect(checkSyncIdOverlap('P', { P: 'special_notes' })).not.toBeNull();
  });

  it('겹치지 않는 빈 열은 통과(null)', () => {
    expect(checkSyncIdOverlap('AI', { A: 'scheduled_install_date', M: 'special_notes' })).toBeNull();
  });
});
