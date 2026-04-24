import { NextResponse, type NextRequest } from 'next/server';

export function middleware(_req: NextRequest) {
  // Supabase 세션 검증 + IP 화이트리스트 + role 검증 자리
  // 05_SCAFFOLDING.md §2.2 · 02_IA/04_PERMISSIONS.md §9 기반
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/health).*)',
  ],
};
