/**
 * Rate Limiting — Upstash Redis (production) + in-memory (dev fallback).
 *
 * 사전 조건 (production):
 *   - .env: UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 *   - Upstash Console 가입 (_HANDOFF_PHASE2.md §2)
 *
 * 미설정 시 in-memory 자동 fallback — dev 환경 호환.
 *
 * 사용:
 *   const result = await rateLimit(`getphone:${session.userId}`, 5, 60);
 *   if (!result.allowed) return { ok: false, error: '잠시 후 다시 시도해 주세요.' };
 */

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

// in-memory store (Edge Runtime 호환 — Map 사용)
const memoryStore = new Map<string, { count: number; resetAt: number }>();

function memoryRateLimit(key: string, limit: number, windowSeconds: number): RateLimitResult {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || entry.resetAt < now) {
    const resetAt = now + windowSeconds * 1000;
    memoryStore.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  // 새 객체로 교체 (immutability — 동시 요청 race 완화)
  const nextCount = entry.count + 1;
  memoryStore.set(key, { count: nextCount, resetAt: entry.resetAt });
  return { allowed: true, remaining: limit - nextCount, resetAt: entry.resetAt };
}

async function upstashRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
  url: string,
  token: string,
): Promise<RateLimitResult> {
  const fullKey = `rl:${key}`;

  // INCR + PTTL + EXPIRE NX (atomic pipeline) — PTTL 로 실제 남은 TTL 조회
  const res = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([
      ['INCR', fullKey],
      ['EXPIRE', fullKey, windowSeconds, 'NX'],
      ['PTTL', fullKey],
    ]),
  });
  if (!res.ok) throw new Error(`upstash_${res.status}`);
  const data = (await res.json()) as { result: number }[];
  const count = data[0]?.result ?? 0;
  const pttlMs = data[2]?.result ?? windowSeconds * 1000;
  // PTTL 음수 (-1: TTL 없음, -2: 키 없음) 방어
  const ttlMs = pttlMs > 0 ? pttlMs : windowSeconds * 1000;
  const resetAt = Date.now() + ttlMs;

  if (count > limit) {
    return { allowed: false, remaining: 0, resetAt };
  }
  return { allowed: true, remaining: limit - count, resetAt };
}

/**
 * @param key  rate-limit identifier (예: `getphone:${userId}:${orderId}`)
 * @param limit 윈도우 내 최대 호출 수
 * @param windowSeconds 윈도우 길이 (초)
 *
 * 정책:
 *   - Upstash 설정 시: Upstash 사용. 호출 실패는 throw → 호출자가 fail-closed 결정.
 *   - 미설정 시: in-memory fallback (dev/single-instance 호환).
 *   - **운영(multi-instance)에서는 Upstash 필수** — 미설정 시 인스턴스별 카운터 우회 가능.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    try {
      return await upstashRateLimit(key, limit, windowSeconds, url, token);
    } catch (error) {
      // Upstash 장애 시 fail-closed (보안 민감 엔드포인트는 차단이 안전).
      // 호출자가 error 메시지로 일시 장애를 인지할 수 있도록 명시적 거부.
      console.error('[rate-limit] upstash failure — fail-closed', error);
      return { allowed: false, remaining: 0, resetAt: Date.now() + windowSeconds * 1000 };
    }
  }

  return memoryRateLimit(key, limit, windowSeconds);
}
