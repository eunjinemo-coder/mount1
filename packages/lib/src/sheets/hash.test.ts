import { describe, expect, it } from 'vitest';
import { canonicalize, contentHash, sameContent } from './hash';

describe('contentHash — 안정성(에코루프/멱등 기반)', () => {
  it('키 삽입순서가 달라도 같은 해시', () => {
    const a = contentHash({ scheduled_date: '2026-07-10', status: 'scheduled' });
    const b = contentHash({ status: 'scheduled', scheduled_date: '2026-07-10' });
    expect(a).toBe(b);
  });

  it('앞뒤 공백은 정규화되어 같은 해시(시트 되돌이 에코 대비)', () => {
    const app = contentHash({ status: 'scheduled' });
    const echoed = contentHash({ status: '  scheduled  ' });
    expect(app).toBe(echoed);
  });

  it('빈칸 필드와 미존재 필드는 동일 취급(시트 빈셀 호환)', () => {
    const withEmpty = contentHash({ status: 'scheduled', note: '' });
    const without = contentHash({ status: 'scheduled' });
    expect(withEmpty).toBe(without);
  });

  it('값이 다르면 해시가 다르다', () => {
    expect(contentHash({ status: 'scheduled' })).not.toBe(contentHash({ status: 'assigned' }));
  });

  it('동일 입력 반복 시 결정적(deterministic)', () => {
    const row = { a: '1', b: '2', c: '가나다' };
    expect(contentHash(row)).toBe(contentHash(row));
  });

  it('sameContent 는 정규화 후 비교', () => {
    expect(sameContent({ x: 'v' }, { x: ' v ' })).toBe(true);
    expect(sameContent({ x: 'v' }, { x: 'w' })).toBe(false);
  });

  it('canonicalize 는 정렬·trim·빈값제거된 객체', () => {
    expect(canonicalize({ b: ' 2 ', a: '1', empty: '  ' })).toEqual({ a: '1', b: '2' });
  });
});
