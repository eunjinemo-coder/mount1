import { describe, expect, it, vi } from 'vitest';
import { createSolapiSender, type FetchFn } from './solapi';
import type { MessageRow, SolapiConfig, StaticTextConfig } from './types';

const baseConfig: SolapiConfig = {
  apiKey: 'KEY',
  apiSecret: 'SECRET',
  sender: '025550000',
  pfId: 'PF123',
  adminPhone: '01099998888',
  templateIds: {},
};

const textConfig: StaticTextConfig = {
  brand: '🛠 벽걸이프로',
  bankInfo: 'OO은행 000',
  lookupUrl: 'https://s.example.com/order/lookup',
};

function row(over: Partial<MessageRow> = {}): MessageRow {
  return {
    id: 'm1',
    dedupeKey: 'k',
    orderId: 'o1',
    template: 'payment_confirmed',
    toPhone: '010-1234-5678',
    status: 'pending',
    attempts: 0,
    variables: { order_no: 'WP260703-1' },
    ...over,
  };
}

/** 큐잉된 응답을 순서대로 반환하고 요청 본문을 기록하는 fetch mock. */
function makeFetch(responses: { ok: boolean; status: number; body: unknown }[]): {
  fetchFn: FetchFn;
  calls: { url: string; body: { message: Record<string, unknown> } }[];
} {
  const calls: { url: string; body: { message: Record<string, unknown> } }[] = [];
  let i = 0;
  const fetchFn: FetchFn = vi.fn(async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    const r = responses[Math.min(i, responses.length - 1)]!;
    i += 1;
    return { ok: r.ok, status: r.status, json: async () => r.body };
  });
  return { fetchFn, calls };
}

const opts = { now: () => '2026-07-03T00:00:00Z', makeSalt: () => 'SALT' };

describe('createSolapiSender — 알림톡(ATA) 우선', () => {
  it('template id 있으면 ATA 로 발송, 성공 시 channel=ATA', async () => {
    const { fetchFn, calls } = makeFetch([{ ok: true, status: 200, body: { statusCode: '2000', messageId: 'M1' } }]);
    const sender = createSolapiSender(
      { ...baseConfig, templateIds: { payment_confirmed: 'TPL_PAY' } },
      textConfig,
      { fetchFn, ...opts },
    );
    const r = await sender.send(row());
    expect(r).toEqual({ ok: true, channel: 'ATA', providerMessageId: 'M1' });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.body.message.type).toBe('ATA');
    expect((calls[0]!.body.message.kakaoOptions as { templateId: string }).templateId).toBe('TPL_PAY');
    // 구매자 전화 숫자정규화
    expect(calls[0]!.body.message.to).toBe('01012345678');
  });
});

describe('createSolapiSender — SMS/LMS 폴백', () => {
  it('ATA 실패 시 SMS/LMS 로 재발송(폴백)', async () => {
    const { fetchFn, calls } = makeFetch([
      { ok: true, status: 200, body: { statusCode: '4000', statusMessage: '미승인 템플릿' } }, // ATA 실패
      { ok: true, status: 200, body: { statusCode: '2000', messageId: 'M2' } }, // SMS 성공
    ]);
    const sender = createSolapiSender(
      { ...baseConfig, templateIds: { payment_confirmed: 'TPL_PAY' } },
      textConfig,
      { fetchFn, ...opts },
    );
    const r = await sender.send(row());
    expect(r.ok).toBe(true);
    expect(calls).toHaveLength(2);
    expect(calls[0]!.body.message.type).toBe('ATA');
    expect(['SMS', 'LMS']).toContain(calls[1]!.body.message.type);
  });

  it('template id 미설정(베타)이면 곧장 SMS/LMS 직접발송', async () => {
    const { fetchFn, calls } = makeFetch([{ ok: true, status: 200, body: { statusCode: '2000' } }]);
    const sender = createSolapiSender(baseConfig, textConfig, { fetchFn, ...opts });
    const r = await sender.send(row());
    expect(r.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(['SMS', 'LMS']).toContain(calls[0]!.body.message.type);
  });
});

describe('createSolapiSender — 수신번호 정책(비용폭탄 방지)', () => {
  it('admin 템플릿은 센티넬 대신 env adminPhone 으로만 발송', async () => {
    const { fetchFn, calls } = makeFetch([{ ok: true, status: 200, body: { statusCode: '2000' } }]);
    const sender = createSolapiSender(baseConfig, textConfig, { fetchFn, ...opts });
    await sender.send(row({ template: 'new_order_admin', toPhone: '__admin__', variables: { order_no: 'WP1', total_amount: 1000 } }));
    expect(calls[0]!.body.message.to).toBe('01099998888');
  });

  it('adminPhone 미설정이면 발송 안 함(no_recipient)', async () => {
    const { fetchFn, calls } = makeFetch([{ ok: true, status: 200, body: {} }]);
    const sender = createSolapiSender({ ...baseConfig, adminPhone: '' }, textConfig, { fetchFn, ...opts });
    const r = await sender.send(row({ template: 'new_order_admin', toPhone: '__admin__' }));
    expect(r.ok).toBe(false);
    expect(r.error).toBe('no_recipient');
    expect(calls).toHaveLength(0);
  });
});

describe('createSolapiSender — 방어', () => {
  it('미지 템플릿은 발송하지 않고 에러', async () => {
    const { fetchFn, calls } = makeFetch([{ ok: true, status: 200, body: {} }]);
    const sender = createSolapiSender(baseConfig, textConfig, { fetchFn, ...opts });
    const r = await sender.send(row({ template: 'weird' }));
    expect(r.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('네트워크 예외를 삼켜 ok:false 반환(throw 안 함)', async () => {
    const fetchFn: FetchFn = vi.fn(async () => {
      throw new Error('ECONNRESET');
    });
    const sender = createSolapiSender(baseConfig, textConfig, { fetchFn, ...opts });
    const r = await sender.send(row());
    expect(r.ok).toBe(false);
  });

  it('에러 문자열에 전화 원문이 없다(PII 미노출)', async () => {
    const { fetchFn } = makeFetch([{ ok: false, status: 400, body: { errorMessage: 'bad request' } }]);
    const sender = createSolapiSender(baseConfig, textConfig, { fetchFn, ...opts });
    const r = await sender.send(row({ toPhone: '01012345678' }));
    expect(r.ok).toBe(false);
    expect(r.error ?? '').not.toContain('01012345678');
  });
});
