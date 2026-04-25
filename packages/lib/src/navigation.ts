/**
 * 안전한 redirect path 검증 helper.
 * Open Redirect 공격 방어 — 외부 URL 또는 protocol-relative URL 차단.
 */
export function toSafeRedirectPath(value?: string | null): string | undefined {
  if (!value) return undefined;
  return value.startsWith('/') && !value.startsWith('//') ? value : undefined;
}
