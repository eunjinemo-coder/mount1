import { describe, expect, it, vi } from 'vitest';
import { enqueueMessage, flushMessage, flushPending } from './enqueue';
import type { MessageRow, MessageStore, SendResult, Sender } from './types';

function makeRow(over: Partial<MessageRow> = {}): MessageRow {
  return {
    id: 'm1',
    dedupeKey: 'payment_confirmed:o1',
    orderId: 'o1',
    template: 'payment_confirmed',
    toPhone: '01012345678',
    status: 'pending',
    attempts: 0,
    variables: {},
    ...over,
  };
}

function makeStore(over: Partial<MessageStore> = {}): MessageStore {
  return {
    insertPending: vi.fn().mockResolvedValue({ inserted: true }),
    listRetryable: vi.fn().mockResolvedValue([]),
    markSent: vi.fn().mockResolvedValue(undefined),
    markFailed: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

function makeSender(result: SendResult): Sender {
  return { send: vi.fn().mockResolvedValue(result) };
}

describe('enqueueMessage — 멱등', () => {
  it('dedupe 충돌 시 inserted:false 전달', async () => {
    const store = makeStore({ insertPending: vi.fn().mockResolvedValue({ inserted: false }) });
    const r = await enqueueMessage(store, {
      dedupeKey: 'admin_new_order:o1',
      orderId: 'o1',
      template: 'new_order_admin',
      toPhone: '__admin__',
      variables: {},
    });
    expect(r.inserted).toBe(false);
  });
});

describe('flushMessage', () => {
  it('성공 → markSent, markFailed 미호출', async () => {
    const store = makeStore();
    const sender = makeSender({ ok: true, channel: 'ATA', providerMessageId: 'M1' });
    await flushMessage(store, sender, makeRow());
    expect(store.markSent).toHaveBeenCalledWith('m1', 'ATA', 'M1');
    expect(store.markFailed).not.toHaveBeenCalled();
  });

  it('실패 → markFailed(에러기록·attempts 증가는 store 구현)', async () => {
    const store = makeStore();
    const sender = makeSender({ ok: false, error: 'status_4000' });
    await flushMessage(store, sender, makeRow());
    expect(store.markFailed).toHaveBeenCalledWith('m1', 'status_4000');
    expect(store.markSent).not.toHaveBeenCalled();
  });
});

describe('flushPending — 크론 재실행 안전', () => {
  it('pending 1건 → 발송 1회, 이후 listRetryable 이 빈 배열이면 재발송 0', async () => {
    const sender = makeSender({ ok: true, channel: 'SMS' });
    const listRetryable = vi
      .fn()
      .mockResolvedValueOnce([makeRow()]) // 1차 틱: 1건
      .mockResolvedValueOnce([]); // 2차 틱: sent 되어 대상 없음
    const store = makeStore({ listRetryable });

    const first = await flushPending(store, sender);
    expect(first).toEqual({ processed: 1, sent: 1, failed: 0 });
    expect(sender.send).toHaveBeenCalledTimes(1);

    const second = await flushPending(store, sender);
    expect(second).toEqual({ processed: 0, sent: 0, failed: 0 });
    expect(sender.send).toHaveBeenCalledTimes(1); // 추가 발송 없음
  });

  it('혼합 결과 집계(sent/failed)', async () => {
    const sender: Sender = {
      send: vi
        .fn()
        .mockResolvedValueOnce({ ok: true, channel: 'SMS' })
        .mockResolvedValueOnce({ ok: false, error: 'x' }),
    };
    const store = makeStore({
      listRetryable: vi.fn().mockResolvedValue([makeRow({ id: 'a' }), makeRow({ id: 'b' })]),
    });
    const r = await flushPending(store, sender);
    expect(r).toEqual({ processed: 2, sent: 1, failed: 1 });
  });
});
