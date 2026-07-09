import { describe, expect, it } from 'vitest';
import { buildOrderPatch, scheduledDateToTimestamp, toFields, type OrderJoinRow } from './mapping';

const ROW: OrderJoinRow = {
  id: 'o1',
  status: 'scheduled',
  scheduled_installation_at: '2026-07-10T01:00:00.000Z', // KST 10:00
  tv_brand: 'LG',
  tv_model: 'OLED55',
  tv_size_inch: 55,
  special_notes: '문 앞',
  updated_at: '2026-07-09T00:00:00.000Z',
  customers: { phone_tail4: '5678', address_region_sido: '서울', address_region_sigungu: '강남구' },
  technicians: { display_name: '김기사' },
};

describe('toFields — orders → 시트 매핑필드(읽기 투영)', () => {
  it('핵심 필드 매핑 + scheduled_date KST 날짜화', () => {
    const f = toFields(ROW);
    expect(f.status).toBe('scheduled');
    expect(f.scheduled_date).toMatch(/^2026-07-10$/);
    expect(f.phone_tail4).toBe('5678');
    expect(f.region_sigungu).toBe('강남구');
    expect(f.technician_name).toBe('김기사');
    expect(f.tv_size).toBe('55');
  });

  it('null 필드는 제외', () => {
    const f = toFields({ ...ROW, special_notes: null, technicians: null, customers: null });
    expect(f.special_notes).toBeUndefined();
    expect(f.technician_name).toBeUndefined();
    expect(f.phone_tail4).toBeUndefined();
  });
});

describe('scheduledDateToTimestamp — KST 자정', () => {
  it('YYYY-MM-DD → KST 자정 = 전날 15:00Z', () => {
    expect(scheduledDateToTimestamp('2026-07-10')).toBe('2026-07-09T15:00:00.000Z');
  });
  it('잘못된 형식 → null', () => {
    expect(scheduledDateToTimestamp('2026/07/10')).toBeNull();
    expect(scheduledDateToTimestamp('bad')).toBeNull();
  });
});

describe('buildOrderPatch — 시트발 쓰기 패치(오염 차단)', () => {
  it('허용 status(enum) 만 반영', () => {
    expect(buildOrderPatch({ status: 'assigned' }).status).toBe('assigned');
    expect(buildOrderPatch({ status: 'made_up_status' }).status).toBeUndefined();
  });

  it('scheduled_date → scheduled_installation_at 변환', () => {
    const p = buildOrderPatch({ scheduled_date: '2026-07-10' });
    expect(p.scheduled_installation_at).toBe('2026-07-09T15:00:00.000Z');
  });

  it('읽기전용 투영 필드(phone_tail4/region 등)는 패치에 포함 안 됨(orders 미오염)', () => {
    const p = buildOrderPatch({
      status: 'assigned',
      phone_tail4: '9999',
      region_sido: '부산',
      technician_name: '해커',
      tv_brand: 'FAKE',
    });
    expect(p).toEqual({ status: 'assigned' });
  });

  it('반영할 필드 없으면 빈 패치', () => {
    expect(buildOrderPatch({ region_sido: '서울' })).toEqual({});
  });
});
