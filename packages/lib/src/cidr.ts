/**
 * IPv4 CIDR 매칭 — IPv6는 Phase 2 (_HANDOFF_PHASE2.md §3 참조).
 *
 * admin IP whitelist 검증용. `admin_users.ip_whitelist` (jsonb CIDR 배열) 항목 매칭.
 */

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let result = 0;
  for (const p of parts) {
    const n = Number(p);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    result = (result << 8) | n;
  }
  return result >>> 0;
}

/**
 * 단일 CIDR 매칭. `192.168.1.5`, `192.168.1.0/24` → true.
 * `/` 없으면 `/32` (정확 일치) 로 간주.
 */
export function matchCidr(ip: string, cidr: string): boolean {
  const slashIdx = cidr.indexOf('/');
  const network = slashIdx === -1 ? cidr : cidr.slice(0, slashIdx);
  const bits = slashIdx === -1 ? 32 : Number(cidr.slice(slashIdx + 1));
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const networkInt = ipv4ToInt(network);
  const ipInt = ipv4ToInt(ip);
  if (networkInt === null || ipInt === null) return false;
  if (bits === 0) return true;
  const mask = bits === 32 ? 0xffffffff : (~((1 << (32 - bits)) - 1)) >>> 0;
  return (networkInt & mask) === (ipInt & mask);
}

export function matchAnyCidr(ip: string, cidrs: readonly string[]): boolean {
  for (const c of cidrs) {
    if (typeof c === 'string' && matchCidr(ip, c)) return true;
  }
  return false;
}
