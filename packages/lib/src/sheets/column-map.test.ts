import { describe, expect, it } from 'vitest';
import {
  buildSheetRow,
  columnLetterToIndex,
  mappedFieldsForHash,
  parseSheetRow,
} from './column-map';
import type { ColumnMap } from './types';

const MAP: ColumnMap = {
  A: '_sync', // 무시(별도 sync_id_column 이지만 매핑에 있어도 문자열로 처리)
  B: 'scheduled_date',
  C: 'status',
  D: 'customer_phone',
  E: 'note',
};

describe('columnLetterToIndex', () => {
  it('A→0, B→1, Z→25, AA→26', () => {
    expect(columnLetterToIndex('A')).toBe(0);
    expect(columnLetterToIndex('B')).toBe(1);
    expect(columnLetterToIndex('Z')).toBe(25);
    expect(columnLetterToIndex('AA')).toBe(26);
  });
  it('무효 문자는 -1', () => {
    expect(columnLetterToIndex('1')).toBe(-1);
    expect(columnLetterToIndex('A1')).toBe(-1);
  });
});

describe('parseSheetRow — 형식검증(§2.4 앱 미오염)', () => {
  it('정상 행 파싱 + 날짜/전화 표준화', () => {
    const { fields, warnings } = parseSheetRow(
      ['uuid-x', '2026.07.10', 'scheduled', '010-1234-5678', '메모'],
      MAP,
    );
    expect(warnings).toHaveLength(0);
    expect(fields.scheduled_date).toBe('2026-07-10'); // 점 → ISO
    expect(fields.customer_phone).toBe('01012345678'); // 하이픈 제거
    expect(fields.status).toBe('scheduled');
    expect(fields.note).toBe('메모');
  });

  it('잘못된 날짜 → 경고 + 해당 필드 미반영(앱 오염 방지)', () => {
    const { fields, warnings } = parseSheetRow(['u', '2026-02-30', 'scheduled', '', ''], MAP);
    expect(warnings).toContainEqual({ field: 'scheduled_date', value: '2026-02-30', rule: 'date' });
    expect(fields.scheduled_date).toBeUndefined();
    expect(fields.status).toBe('scheduled'); // 다른 필드는 정상 반영
  });

  it('잘못된 전화(문자 포함/자릿수 미달) → 경고', () => {
    const r1 = parseSheetRow(['u', '', '', 'abc-defg', ''], MAP);
    expect(r1.warnings).toContainEqual({ field: 'customer_phone', value: 'abc-defg', rule: 'phone' });
    const r2 = parseSheetRow(['u', '', '', '123', ''], MAP);
    expect(r2.warnings.some((w) => w.field === 'customer_phone')).toBe(true);
  });

  it('누락 열(값 배열이 짧음) → 관대 처리(빈칸=미제공)', () => {
    const { fields, warnings } = parseSheetRow(['u', '2026-07-10'], MAP);
    expect(warnings).toHaveLength(0);
    expect(fields.scheduled_date).toBe('2026-07-10');
    expect(fields.status).toBeUndefined();
    expect(fields.customer_phone).toBeUndefined();
  });

  it('추가 열(매핑에 없는 열)은 무시', () => {
    const { fields } = parseSheetRow(['u', '2026-07-10', 'scheduled', '01012345678', 'n', 'EXTRA', 'EXTRA2'], MAP);
    expect(Object.values(fields)).not.toContain('EXTRA');
  });
});

describe('phone_tail4 — 전화 규칙에서 제외(허위 형식오류 방지)', () => {
  const m: ColumnMap = { A: 'status', B: 'phone_tail4' }; // A=idx0, B=idx1
  it('4자리 뒷번호는 경고 없이 일반 문자열로', () => {
    const { fields, warnings } = parseSheetRow(['scheduled', '5678'], m);
    expect(warnings).toHaveLength(0);
    expect(fields.phone_tail4).toBe('5678');
  });
  it('선행0 뒷번호도 보존(RAW 저장 전제)', () => {
    const { fields, warnings } = parseSheetRow(['scheduled', '0512'], m);
    expect(warnings).toHaveLength(0);
    expect(fields.phone_tail4).toBe('0512');
  });
});

describe('mappedFieldsForHash — 앱→시트 값의 웹훅 되파싱 정본(C1)', () => {
  const map: ColumnMap = { B: 'scheduled_date', C: 'status', E: 'special_notes' };
  it('매핑된 필드만 남기고 나머지(전체필드)는 해시 대상에서 제외', () => {
    const full = {
      status: 'scheduled',
      scheduled_date: '2026-07-10',
      special_notes: '메모',
      region_sido: '서울', // 매핑 안 됨
      technician_name: '김기사', // 매핑 안 됨
    };
    const result = mappedFieldsForHash(full, map);
    expect(result).toEqual({ scheduled_date: '2026-07-10', status: 'scheduled', special_notes: '메모' });
    expect(result.region_sido).toBeUndefined();
    expect(result.technician_name).toBeUndefined();
  });
});

describe('buildSheetRow — 앱→시트 셀 위치 지정', () => {
  it('필드를 열문자 키로 역매핑', () => {
    const cells = buildSheetRow({ scheduled_date: '2026-07-10', status: 'assigned' }, MAP);
    expect(cells).toEqual({ B: '2026-07-10', C: 'assigned' });
  });
  it('매핑 안 된 필드는 시트에 쓰지 않음', () => {
    const cells = buildSheetRow({ unknown_field: 'x', status: 'scheduled' }, MAP);
    expect(cells).toEqual({ C: 'scheduled' });
  });
});
