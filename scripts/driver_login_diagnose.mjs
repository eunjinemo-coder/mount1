// driver 로그인 직접 진단 — fetch만 사용 (의존 X)
// 실행: cd /c/dev/MOUNT1 && node scripts/driver_login_diagnose.mjs

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../apps/admin/.env.local');
const envText = readFileSync(envPath, 'utf-8');
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('SUPABASE_URL:', URL);
console.log('ANON length:', ANON?.length);
console.log('SERVICE length:', SERVICE?.length);

if (!URL || !ANON || !SERVICE) {
  console.error('환경변수 누락');
  process.exit(1);
}

// 1. 기사 목록 조회 (service_role 권한)
console.log('\n--- 기사 목록 ---');
const techRes = await fetch(`${URL}/rest/v1/technicians?select=login_id,auth_user_id,display_name,status,created_at&order=created_at.desc&limit=3`, {
  headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
});
const techs = await techRes.json();
console.log(JSON.stringify(techs, null, 2));

if (!Array.isArray(techs) || techs.length === 0) {
  console.log('기사 없음');
  process.exit(0);
}

const target = techs[0];
const TEST_PWD = 'Driver1!';
console.log(`\n--- target: ${target.login_id} (auth_user_id=${target.auth_user_id}) ---`);

// 2. service_role로 비번 직접 set (admin auth API)
console.log('\n--- 비번 reset via auth admin API ---');
const updRes = await fetch(`${URL}/auth/v1/admin/users/${target.auth_user_id}`, {
  method: 'PUT',
  headers: {
    apikey: SERVICE,
    Authorization: `Bearer ${SERVICE}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ password: TEST_PWD, email_confirm: true }),
});
const updBody = await updRes.json();
console.log('status:', updRes.status);
console.log('email:', updBody.email);
console.log('email_confirmed_at:', updBody.email_confirmed_at);

// 3. ANON으로 driver 흐름과 동일한 sign-in 시도
const fakeEmail = `technician_${target.login_id}@mountpartners.cloud`;
console.log('\n--- driver 시뮬레이션: anon sign-in ---');
console.log('email:', fakeEmail);
console.log('password:', TEST_PWD);

const signRes = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: {
    apikey: ANON,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ email: fakeEmail, password: TEST_PWD }),
});
const signBody = await signRes.json();
console.log('\nstatus:', signRes.status);
console.log('body:', JSON.stringify(signBody, null, 2).slice(0, 400));

if (signRes.status === 200 && signBody.access_token) {
  console.log('\n✅✅✅ sign-in SUCCESS!');
  console.log('→ DB는 정상. driver Vercel 빌드/env 문제로만 driver app 못 들어가는 것.');
  console.log('\n=== driver 로그인 시 입력 ===');
  console.log('아이디:', target.login_id);
  console.log('비밀번호:', TEST_PWD);
} else {
  console.log('\n❌ sign-in FAIL');
  console.log('→ DB·auth 측 문제. driver 무관.');
}
