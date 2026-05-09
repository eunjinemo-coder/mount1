// 전화걸기 진단: rpc_technician_get_customer_phone 직접 호출
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

// driver sign-in
const techRes = await fetch(`${URL}/rest/v1/technicians?select=login_id,auth_user_id,id&order=created_at.desc&limit=1`, {
  headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
});
const [target] = await techRes.json();
await fetch(`${URL}/auth/v1/admin/users/${target.auth_user_id}`, {
  method: 'PUT',
  headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ password: 'Driver1!', email_confirm: true }),
});
const sign = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: `technician_${target.login_id}@mountpartners.cloud`, password: 'Driver1!' }),
});
const { access_token } = await sign.json();
const driverHeaders = { apikey: ANON, Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' };

// 본인 주문 1개 가져오기
const ordRes = await fetch(`${URL}/rest/v1/orders?select=id,customer_id&limit=1`, { headers: driverHeaders });
const [order] = await ordRes.json();
console.log('order:', order);

if (!order?.id) {
  console.log('주문 없음 — sign-in 후 RLS 통과 안 됨');
  process.exit(0);
}

// rpc_technician_get_customer_phone 호출
console.log('\n=== rpc_technician_get_customer_phone ===');
const rpcRes = await fetch(`${URL}/rest/v1/rpc/rpc_technician_get_customer_phone`, {
  method: 'POST',
  headers: driverHeaders,
  body: JSON.stringify({ p_order_id: order.id }),
});
const rpcBody = await rpcRes.json();
console.log('status:', rpcRes.status);
console.log('body:', JSON.stringify(rpcBody, null, 2));

if (rpcRes.status !== 200) {
  console.log('\n결론: RPC 에러 — 진단 후 fix 필요');
} else if (!rpcBody?.phone) {
  console.log('\n결론: RPC ok=true 인데 phone 빈 값 — 복호화 실패 (테스트 customer dummy phone)');
  console.log('FIX: 테스트 customer 의 phone_encrypted 를 정상 vault key 로 암호화한 값으로 set');
} else {
  console.log('\n결론: phone 정상 반환됨 →', rpcBody.phone);
  console.log('드라이버 화면에서 안 되는 건 PC 브라우저에서 tel: 못 처리하기 때문 — 모바일에서 테스트 필요');
}
