import { cache } from 'react';
import { getServerClient } from '@mount/db';
import type { AdminRole, UserType } from './sign-in';

export interface AppSession {
  userId: string;
  userType: UserType | null;
  adminRole: AdminRole | null;
  technicianId: string | null;
  adminUserId: string | null;
}

function parseUserType(value: unknown): UserType | null {
  return value === 'admin' || value === 'technician' ? value : null;
}

function parseAdminRole(value: unknown): AdminRole | null {
  return value === 'super_admin' ||
    value === 'cs_admin' ||
    value === 'dispatch_admin' ||
    value === 'ops_admin' ||
    value === 'auditor'
    ? value
    : null;
}

function parseOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * 현재 세션 조회. 미로그인 시 null.
 *
 * 세션 데이터는 두 단계로 결정:
 * 1. JWT app_metadata 우선 (Hook 이 채움 — 빠르고 DB hit 0)
 * 2. JWT 비어있으면 admin_users / technicians 직접 lookup (Hook OFF / 미설정 안전망)
 *
 * RLS 정책 admin_users_select_self / technicians_select_self 가 본인 row 만 허용.
 *
 * React cache(): 한 요청 안에서 page(requireRole)·AdminShell 등이 각자 getSession 을 불러도
 * Supabase auth 네트워크 왕복은 1회만 — 페이지 전환 지연의 주범이던 중복 인증 호출 제거.
 */
export const getSession = cache(async (): Promise<AppSession | null> => {
  const client = await getServerClient();
  const { data } = await client.auth.getUser();
  const user = data.user;

  if (!user) {
    return null;
  }

  const metadata = (user.app_metadata ?? {}) as Record<string, unknown>;
  let userType = parseUserType(metadata.user_type);
  let adminRole = parseAdminRole(metadata.admin_role);
  let adminUserId = parseOptionalString(metadata.admin_user_id);
  let technicianId = parseOptionalString(metadata.technician_id);

  // Hook 이 채우지 못한 경우 DB fallback (admin 우선)
  if (!userType) {
    const { data: adminRow } = await client
      .from('admin_users')
      .select('id, role, status')
      .eq('auth_user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (adminRow) {
      userType = 'admin';
      adminRole = parseAdminRole(adminRow.role);
      adminUserId = adminRow.id;
    } else {
      const { data: techRow } = await client
        .from('technicians')
        .select('id, status')
        .eq('auth_user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (techRow) {
        userType = 'technician';
        technicianId = techRow.id;
      }
    }
  }

  return {
    userId: user.id,
    userType,
    adminRole,
    technicianId,
    adminUserId,
  };
});
