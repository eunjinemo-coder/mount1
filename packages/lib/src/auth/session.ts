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

/** 현재 세션 조회. 미로그인 시 null */
export async function getSession(): Promise<AppSession | null> {
  const client = await getServerClient();
  const { data } = await client.auth.getUser();
  const user = data.user;

  if (!user) {
    return null;
  }

  // Supabase UserAppMetadata 는 [key: string]: any 시그니처 — Record 로 받아 타입 가드 통과
  const metadata = (user.app_metadata ?? {}) as Record<string, unknown>;

  return {
    userId: user.id,
    userType: parseUserType(metadata.user_type),
    adminRole: parseAdminRole(metadata.admin_role),
    technicianId: parseOptionalString(metadata.technician_id),
    adminUserId: parseOptionalString(metadata.admin_user_id),
  };
}
