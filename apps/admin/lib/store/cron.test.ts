import { describe, expect, it, vi } from 'vitest';
import { storeCronTick, type CronDeps } from './cron';
import type { FlushSummary } from '@mount/lib/notify';

const EMPTY: FlushSummary = { processed: 0, sent: 0, failed: 0 };

function makeDeps(over: Partial<CronDeps> = {}): CronDeps {
  return {
    enqueueReminders: vi.fn().mockResolvedValue({ data: { enqueued: 2 }, error: null }),
    expireOrders: vi.fn().mockResolvedValue({ data: { expired: 1 }, error: null }),
    flush: vi.fn().mockResolvedValue({ processed: 3, sent: 3, failed: 0 } satisfies FlushSummary),
    onUnknownError: vi.fn(),
    ...over,
  };
}

describe('storeCronTick', () => {
  it('정상 틱 → 리마인드/만료/flush 집계 반환', async () => {
    const deps = makeDeps();
    const r = await storeCronTick(deps);
    expect(r.reminders).toBe(2);
    expect(r.expired).toBe(1);
    expect(r.flush).toEqual({ processed: 3, sent: 3, failed: 0 });
    expect(r.errors).toHaveLength(0);
  });

  it('리마인드/만료를 flush 보다 먼저 실행(새 pending 을 이번 틱에 발송)', async () => {
    const order: string[] = [];
    const deps = makeDeps({
      enqueueReminders: vi.fn(async () => {
        order.push('reminders');
        return { data: { enqueued: 0 }, error: null };
      }),
      expireOrders: vi.fn(async () => {
        order.push('expire');
        return { data: { expired: 0 }, error: null };
      }),
      flush: vi.fn(async () => {
        order.push('flush');
        return EMPTY;
      }),
    });
    await storeCronTick(deps);
    expect(order).toEqual(['reminders', 'expire', 'flush']);
  });

  it('한 단계 실패가 다른 단계를 막지 않는다(부분 성공)', async () => {
    const deps = makeDeps({
      enqueueReminders: vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } }),
    });
    const r = await storeCronTick(deps);
    expect(r.errors).toEqual([{ step: 'reminders', message: 'boom' }]);
    expect(r.expired).toBe(1); // 만료는 정상 진행
    expect(r.flush.sent).toBe(3); // flush 도 정상 진행
    expect(deps.onUnknownError).toHaveBeenCalled();
  });

  it('flush 예외도 격리(reminders/expire 결과 보존)', async () => {
    const deps = makeDeps({ flush: vi.fn().mockRejectedValue(new Error('flush_down')) });
    const r = await storeCronTick(deps);
    expect(r.reminders).toBe(2);
    expect(r.expired).toBe(1);
    expect(r.flush).toEqual(EMPTY);
    expect(r.errors.some((e) => e.step === 'flush')).toBe(true);
  });
});
