'use server';

import { getAdminClient } from '@mount/db/admin';
import { getServerClient } from '@mount/db/server';
import { ForbiddenError, getSession } from '@mount/lib';

const LOGIN_ID_RE = /^[a-z][a-z0-9_]{2,31}$/;
const PHONE_RE = /^010\d{7,8}$/;

export interface CreateTechnicianInput {
  loginId: string;
  displayName: string;
  phone: string;
  grade: 'bronze' | 'silver' | 'gold';
  dailyMaxJobs: number;
  weekendEnabled: boolean;
  vehicleNumber?: string;
  homeBaseRegion?: string;
  preferredRegions?: string[];
}

export interface CreateTechnicianResult {
  ok: boolean;
  /** 발급된 임시 비밀번호 — UI에서 1회만 표시 */
  tempPassword?: string;
  /** 발급된 login_id (echo) */
  loginId?: string;
  technicianId?: string;
  error?: string;
}

/** 12자 강한 비밀번호 자동 생성 — 대·소·숫자·특수 각 1자 이상 보장 */
function generatePassword(): string {
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digit = '23456789';
  const symbol = '!@#$%&*';
  const all = lower + upper + digit + symbol;

  const pick = (set: string): string => set[Math.floor(Math.random() * set.length)] ?? '';

  const required = [pick(lower), pick(upper), pick(digit), pick(symbol)];
  const fill = Array.from({ length: 8 }, () => pick(all));
  const combined = [...required, ...fill];

  for (let i = combined.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [combined[i], combined[j]] = [combined[j]!, combined[i]!];
  }
  return combined.join('');
}

export async function createTechnicianAction(
  input: CreateTechnicianInput,
): Promise<CreateTechnicianResult> {
  // 권한 — super_admin 만
  const session = await getSession();
  if (!session || session.adminRole !== 'super_admin') {
    throw new ForbiddenError('only_super_admin');
  }

  // 입력 검증
  if (!LOGIN_ID_RE.test(input.loginId)) {
    return { ok: false, error: 'login_id 는 영문 소문자 시작 + 영문/숫자/_ 3~32자.' };
  }
  if (!input.displayName || input.displayName.trim().length < 2) {
    return { ok: false, error: '이름을 2자 이상 입력해 주세요.' };
  }
  if (!PHONE_RE.test(input.phone)) {
    return { ok: false, error: '전화번호 형식 오류 (010XXXXXXXX, 하이픈 없이).' };
  }
  if (!['bronze', 'silver', 'gold'].includes(input.grade)) {
    return { ok: false, error: '등급 값 오류.' };
  }
  if (input.dailyMaxJobs < 1 || input.dailyMaxJobs > 20) {
    return { ok: false, error: '일 한도는 1~20.' };
  }

  // 중복 login_id 체크 (server client — RLS 통과 가능 super_admin)
  const userClient = await getServerClient();
  const { data: existing } = await userClient
    .from('technicians')
    .select('id')
    .eq('login_id', input.loginId)
    .maybeSingle();

  if (existing) {
    return { ok: false, error: '이미 사용 중인 login_id 입니다.' };
  }

  // 비밀번호 + fake email 생성
  const tempPassword = generatePassword();
  const fakeEmail = `technician_${input.loginId}@mountpartners.cloud`;

  // service-role 로 auth.users 생성 (identities 매핑 자동)
  const adminClient = getAdminClient();
  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email: fakeEmail,
    password: tempPassword,
    email_confirm: true,
    app_metadata: { provider: 'email' },
    user_metadata: { display_name: input.displayName },
  });

  if (createError || !created.user) {
    return {
      ok: false,
      error: `계정 생성 실패: ${createError?.message ?? 'unknown'}`,
    };
  }

  const authUserId = created.user.id;

  // technicians INSERT (super_admin 으로 RLS 통과)
  const { data: tech, error: techError } = await userClient
    .from('technicians')
    .insert({
      auth_user_id: authUserId,
      login_id: input.loginId,
      display_name: input.displayName,
      phone: input.phone,
      grade: input.grade,
      daily_max_jobs: input.dailyMaxJobs,
      weekend_enabled: input.weekendEnabled,
      vehicle_number: input.vehicleNumber ?? null,
      home_base_region: input.homeBaseRegion ?? null,
      preferred_regions: input.preferredRegions ?? [],
      status: 'active',
    })
    .select('id')
    .single();

  if (techError || !tech) {
    // rollback — auth.users 도 정리
    await adminClient.auth.admin.deleteUser(authUserId);
    return {
      ok: false,
      error: `기사 등록 실패: ${techError?.message ?? 'unknown'}`,
    };
  }

  return {
    ok: true,
    tempPassword,
    loginId: input.loginId,
    technicianId: tech.id,
  };
}
