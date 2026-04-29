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

  entry.count += 1;
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

async function upstashRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
  url: string,
  token: string,
): Promise<RateLimitResult> {
  const fullKey = `rl:${key}`;
  const resetAt = Date.now() + windowSeconds * 1000;

  // INCR + EXPIRE 패턴 (atomic — pipelined)
  try {
    const res = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', fullKey],
        ['EXPIRE', fullKey, windowSeconds, 'NX'],
      ]),
    });
    if (!res.ok) throw new Error(`upstash_${res.status}`);
    const data = (await res.json()) as { result: number }[];
    const count = data[0]?.result ?? 0;

    if (count > limit) {
      return { allowed: false, remaining: 0, resetAt };
    }
    return { allowed: true, remaining: limit - count, resetAt };
  } catch {
    // Upstash 호출 실패 시 in-memory fallback (페일 오픈)
    return memoryRateLimit(key, limit, windowSeconds);
  }
}

/**
 * @param key  rate-limit identifier (예: `getphone:${userId}`)
 * @param limit 윈도우 내 최대 호출 수
 * @param windowSeconds 윈도우 길이 (초)
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    return upstashRateLimit(key, limit, windowSeconds, url, token);
  }

  return memoryRateLimit(key, limit, windowSeconds);
}
