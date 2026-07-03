import { describe, expect, it } from 'vitest';
import {
  ADMIN_RECIPIENT_SENTINEL,
  buildMessageText,
  isKnownTemplate,
  templateRecipient,
} from './templates';
import type { StaticTextConfig } from './types';

const cfg: StaticTextConfig = {
  brand: '🛠 벽걸이프로',
  bankInfo: 'OO은행 000-0000',
  lookupUrl: 'https://store.example.com/order/lookup',
};

describe('templateRecipient', () => {
  it('new_order_admin 은 admin, 나머지는 buyer', () => {
    expect(templateRecipient('new_order_admin')).toBe('admin');
    expect(templateRecipient('payment_confirmed')).toBe('buyer');
    expect(templateRecipient('shipped')).toBe('buyer');
    expect(templateRecipient('payment_reminder')).toBe('buyer');
    expect(templateRecipient('nope')).toBeNull();
  });
});

describe('isKnownTemplate', () => {
  it('미지 템플릿은 false', () => {
    expect(isKnownTemplate('new_order_admin')).toBe(true);
    expect(isKnownTemplate('xyz')).toBe(false);
  });
});

describe('buildMessageText', () => {
  it('금액은 쉼표 표기', () => {
    const t = buildMessageText(
      'new_order_admin',
      { order_no: 'WP260703-1', buyer_name: '김현장', phone_tail4: '5678', items_summary: 'A 2개', total_amount: 1430000 },
      cfg,
    );
    expect(t).toContain('1,430,000원');
    expect(t).toContain('WP260703-1');
  });

  it('shipped 는 택배사 라벨 + 배송조회 URL 포함', () => {
    const t = buildMessageText(
      'shipped',
      { order_no: 'WP260703-2', carrier: 'cj', tracking_no: '1234-5678-9012' },
      cfg,
    );
    expect(t).toContain('CJ대한통운');
    expect(t).toContain('trace.cjlogistics.com');
    expect(t).toContain('123456789012'); // 숫자만
  });

  it('payment_reminder 는 계좌·기한 병합', () => {
    const t = buildMessageText(
      'payment_reminder',
      { order_no: 'WP260703-3', total_amount: 90000, expires_at: '2026-07-06T03:00:00Z' },
      cfg,
    );
    expect(t).toContain('OO은행 000-0000');
    expect(t).toContain('90,000원');
    expect(t).toContain('store.example.com/order/lookup');
  });

  it('미지 템플릿은 null', () => {
    expect(buildMessageText('unknown', {}, cfg)).toBeNull();
  });
});

describe('센티넬 상수', () => {
  it("__admin__ 유지", () => {
    expect(ADMIN_RECIPIENT_SENTINEL).toBe('__admin__');
  });
});
