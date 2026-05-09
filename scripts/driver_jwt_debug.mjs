// 실제 driver sign-in 후 JWT decode — app_metadata 클레임 검증
// 실행: cd /c/dev/MOUNT1 && node scripts/driver_jwt_debug.mjs

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envText = readFileSync(resolve(__dirname, '../apps/admin/.env.local'), 'utf-8');
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 1. 가장 최근 기사 1명 + 비번 reset
const techRes = await fetch(`${URL}/rest/v1/technicians?select=login_id,auth_user_id,id&order=created_at.desc&limit=1`, {
  headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
});
const [target] = await techRes.json();
console.log('target tech:', target);

const TEST_PWD = 'Driver1!';
await fetch(`${URL}/auth/v1/admin/users/${target.auth_user_id}`, {
  method: 'PUT',
  headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ password: TEST_PWD, email_confirm: true }),
});

// 2. ANON으로 sign-in (driver app과 동일)
const fakeEmail = `technician_${target.login_id}@mountpartners.cloud`;
const signRes = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: fakeEmail, password: TEST_PWD }),
});
const signBody = await signRes.json();

if (!signBody.access_token) {
  console.error('sign-in fail:', signBody);
  process.exit(1);
}

// 3. JWT decode
function decodeJwt(token) {
  const [, payload] = token.split('.');
  return JSON.parse(Buffer.from(payload, 'base64').toString());
}

const claims = decodeJwt(signBody.access_token);
console.log('\n=== JWT 클레임 전체 ===');
console.log(JSON.stringify(claims, null, 2));
console.log('\n=== app_metadata ===');
console.log(JSON.stringify(claims.app_metadata, null, 2));

const techIdInJwt = claims.app_metadata?.technician_id;
console.log('\n=== 검증 ===');
console.log('JWT app_metadata.technician_id:', techIdInJwt);
console.log('expected (technicians.id):', target.id);
console.log('일치?', techIdInJwt === target.id);

if (techIdInJwt !== target.id) {
  console.log('\n❌❌❌ Hook이 동작 안 함 — JWT에 technician_id 없거나 다름');
  console.log('→ Dashboard Hook 등록 확인 또는 함수 존재 확인');
} else {
  console.log('\n✅ Hook 정상 — JWT에 technician_id 박힘');
  console.log('→ driver app cookies 또는 다른 RLS 문제');
}

// 4. 받은 access_token으로 v_technician_today 직접 호출
console.log('\n=== access_token 으로 view 직접 호출 ===');
const viewRes = await fetch(`${URL}/rest/v1/v_technician_today?select=*`, {
  headers: { apikey: ANON, Authorization: `Bearer ${signBody.access_token}` },
});
const viewData = await viewRes.json();
console.log('status:', viewRes.status);
console.log('rows:', Array.isArray(viewData) ? viewData.length : 'error');
console.log('data:', JSON.stringify(viewData).slice(0, 500));

// 5. orders 직접 호출 — RLS 통과 여부 확인
console.log('\n=== orders 직접 호출 (RLS 검증) ===');
const ordersRes = await fetch(`${URL}/rest/v1/orders?select=id,status,assigned_technician_id`, {
  headers: { apikey: ANON, Authorization: `Bearer ${signBody.access_token}` },
});
const ordersData = await ordersRes.json();
console.log('status:', ordersRes.status);
console.log('rows:', Array.isArray(ordersData) ? ordersData.length : 'error');
console.log('data:', JSON.stringify(ordersData).slice(0, 500));
