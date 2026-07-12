import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { makeSalt, solapiAuthHeader, solapiSignature } from './hmac';

describe('solapiSignature', () => {
  it('HMAC-SHA256(date+salt, secret) hex 와 일치', () => {
    const secret = 'test-secret';
    const date = '2026-07-03T00:00:00.000Z';
    const salt = 'abc123';
    const expected = createHmac('sha256', secret).update(date + salt).digest('hex');
    expect(solapiSignature(secret, date, salt)).toBe(expected);
  });

  it('salt 가 다르면 서명이 달라진다', () => {
    const a = solapiSignature('s', '2026-07-03T00:00:00Z', 'salt1');
    const b = solapiSignature('s', '2026-07-03T00:00:00Z', 'salt2');
    expect(a).not.toBe(b);
  });
});

describe('solapiAuthHeader', () => {
  it('공식 스킴 포맷을 따른다', () => {
    const header = solapiAuthHeader('KEY', 'SECRET', '2026-07-03T00:00:00Z', 'SALT');
    expect(header).toBe(
      `HMAC-SHA256 apiKey=KEY, date=2026-07-03T00:00:00Z, salt=SALT, signature=${solapiSignature(
        'SECRET',
        '2026-07-03T00:00:00Z',
        'SALT',
      )}`,
    );
  });
});

describe('makeSalt', () => {
  it('매 호출 고유(재사용 금지)', () => {
    expect(makeSalt()).not.toBe(makeSalt());
  });
});
