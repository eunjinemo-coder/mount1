/**
 * 스토어 서버 Supabase 클라이언트 (anon).
 *
 * 스토어프론트는 로그인 사용자가 없다 — 모든 주문/조회/견적은 anon 키로 RPC 또는
 * 공개면 SELECT(RLS published/active) 만 호출한다. @mount/db 의 getServerClient 는
 * 쿠키 기반 SSR 클라이언트지만 세션이 없으면 그대로 anon 역할로 동작하므로 재사용한다.
 *
 * (별도 래퍼를 두는 이유: 스토어 앱 내부에서 import 지점을 단일화하고, 향후 스토어 전용
 *  옵션이 필요해질 때 형제 앱 계약을 건드리지 않고 여기서 조정하기 위함.)
 */
export { getServerClient as getStoreServerClient } from '@mount/db';
export { callRpc } from '@mount/db';
