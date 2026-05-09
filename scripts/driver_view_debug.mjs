// driver access_token으로 view들 단계별 호출 — 어디서 0행 나오는지 정확히 진단
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

// sign-in 받기
const techRes = await fetch(`${URL}/rest/v1/technicians?select=login_id,auth_user_id,id&order=created_at.desc&limit=1`, {
  headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
});
const [target] = await techRes.json();
await fetch(`${URL}/auth/v1/admin/users/${target.auth_user_id}`, {
  method: 'PUT',
  headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ password: 'Driver1!', email_confirm: true }),
});
const signRes = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: `technician_${target.login_id}@mountpartners.cloud`, password: 'Driver1!' }),
});
const { access_token } = await signRes.json();
const driverHeaders = { apikey: ANON, Authorization: `Bearer ${access_token}` };

console.log('target tech:', target.login_id, target.id);

// 1. orders 본인 것
console.log('\n=== 1. orders (RLS) ===');
const r1 = await fetch(`${URL}/rest/v1/orders?select=id,customer_id,scheduled_installation_at,status&limit=5`, { headers: driverHeaders });
const d1 = await r1.json();
console.log('rows:', d1.length, d1);

const customerId = d1[0]?.customer_id;

// 2. v_customer_for_technician 본인 것
console.log('\n=== 2. v_customer_for_technician (driver) ===');
const r2 = await fetch(`${URL}/rest/v1/v_customer_for_technician?select=*`, { headers: driverHeaders });
const d2 = await r2.json();
console.log('status:', r2.status, 'rows:', Array.isArray(d2) ? d2.length : 'error');
console.log(JSON.stringify(d2).slice(0, 400));

// 3. customer_id 명시 검색
if (customerId) {
  console.log(`\n=== 3. v_customer_for_technician?id=eq.${customerId} ===`);
  const r3 = await fetch(`${URL}/rest/v1/v_customer_for_technician?id=eq.${customerId}&select=*`, { headers: driverHeaders });
  const d3 = await r3.json();
  console.log('rows:', Array.isArray(d3) ? d3.length : 'error', d3);
}

// 4. v_technician_today
console.log('\n=== 4. v_technician_today (driver) ===');
const r4 = await fetch(`${URL}/rest/v1/v_technician_today?select=*`, { headers: driverHeaders });
const d4 = await r4.json();
console.log('status:', r4.status, 'rows:', Array.isArray(d4) ? d4.length : 'error');
console.log(JSON.stringify(d4).slice(0, 400));

// 5. customers 직접 (RLS 차단 예상)
console.log('\n=== 5. customers 직접 (예상: 차단) ===');
const r5 = await fetch(`${URL}/rest/v1/customers?select=id&limit=1`, { headers: driverHeaders });
const d5 = await r5.json();
console.log('status:', r5.status, JSON.stringify(d5).slice(0, 200));

console.log('\n=== 결론 ===');
if (d1.length > 0 && Array.isArray(d2) && d2.length === 0) {
  console.log('orders OK, v_customer_for_technician 0행 → v_customer_for_technician RLS/security_invoker 문제');
  console.log('FIX: alter view public.v_customer_for_technician set (security_invoker = false);');
} else if (d1.length > 0 && d2.length > 0 && Array.isArray(d4) && d4.length === 0) {
  console.log('orders OK, v_customer_for_technician OK, v_technician_today 0행 → view 자체 조건 문제');
}
