'use server';

import { getAdminClient } from '@mount/db/admin';
import { getServerClient } from '@mount/db/server';
import { assertAdminRole, generateSecurePassword } from '@mount/lib';
import { revalidatePath } from 'next/cache';

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

export async function createTechnicianAction(
  input: CreateTechnicianInput,
): Promise<CreateTechnicianResult> {
  // 권한 — super_admin 만 (P0 보강 — assertAdminRole 헬퍼 사용)
  await assertAdminRole(['super_admin']);

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

  // 비밀번호 + fake email 생성 (CSPRNG)
  const tempPassword = generateSecurePassword();
  const fakeEmail = `technician_${input.loginId}@mountpartners.cloud`;

  // service-role 로 auth.users 생성 (identities 매핑 자동)
  const adminClient = getAdminClient();
  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email: fakeEmail,
    password: tempPassword,
    email_confirm: true,
    // 핵심: user_type 클레임을 미리 박아야 RLS 의 public.technician_id() 가 동작.
    // technician_id 자체는 technicians INSERT 후 알기 때문에 아래에서 backfill.
    app_metadata: { provider: 'email', user_type: 'technician' },
    user_metadata: { display_name: input.displayName },
  });

  if (createError || !created.user) {
    // P0 — DB 에러 메시지 평문 노출 금지 (내부 schema 노출 방지)
    console.error('[createTechnicianAction] auth.admin.createUser failed:', createError);
    return {
      ok: false,
      error: '계정 생성에 실패했습니다. 관리자에게 문의해 주세요.',
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
    console.error('[createTechnicianAction] technicians INSERT failed:', techError);
    return {
      ok: false,
      error: '기사 등록에 실패했습니다. 관리자에게 문의해 주세요.',
    };
  }

  // 핵심: technician_id 클레임 backfill — RLS 의 public.technician_id() 가 본인 주문 식별 가능하게.
  // 누락 시 driver /today, /order/[id] 등 RLS 적용 view·table 모두 빈 결과 반환.
  const { error: claimError } = await adminClient.auth.admin.updateUserById(authUserId, {
    app_metadata: { provider: 'email', user_type: 'technician', technician_id: tech.id },
  });
  if (claimError) {
    console.error('[createTechnicianAction] technician_id claim backfill failed:', claimError);
    // 하지만 발급 자체는 성공 — 베타 단계에선 SQL 로 보강 가능.
  }

  // P2 — revalidate 누락 보완
  revalidatePath('/technicians');
  revalidatePath(`/technicians/${tech.id}`);

  return {
    ok: true,
    tempPassword,
    loginId: input.loginId,
    technicianId: tech.id,
  };
}
