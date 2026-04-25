import type { AppSession } from './session';
import { getSession } from './session';
import type { AdminRole, UserType } from './sign-in';

export class RedirectError extends Error {
  constructor(public readonly to: string) {
    super(`Redirect to ${to}`);
    this.name = 'RedirectError';
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

function isAllowedSession(
  session: AppSession,
  allowed: UserType[] | { adminRoles: AdminRole[] },
): boolean {
  if (Array.isArray(allowed)) {
    return session.userType !== null && allowed.includes(session.userType);
  }

  return session.adminRole !== null && allowed.adminRoles.includes(session.adminRole);
}

/** 통과 시 AppSession 반환. 미로그인 → throw RedirectError('/login'). 권한 부족 → throw ForbiddenError */
export async function requireRole(
  allowed: UserType[] | { adminRoles: AdminRole[] },
): Promise<AppSession> {
  const session = await getSession();

  if (!session) {
    throw new RedirectError('/login');
  }

  if (!isAllowedSession(session, allowed)) {
    throw new ForbiddenError();
  }

  return session;
}
