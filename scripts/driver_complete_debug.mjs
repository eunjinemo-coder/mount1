// /complete 에러 진단: complete_install_atomic RPC 직접 호출
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

// 본인 주문 + 사진 카운트
const ordRes = await fetch(`${URL}/rest/v1/orders?select=id,status&limit=1`, { headers: driverHeaders });
const [order] = await ordRes.json();
console.log('order:', order);

const photoRes = await fetch(`${URL}/rest/v1/photos?order_id=eq.${order.id}&select=slot`, { headers: driverHeaders });
const photos = await photoRes.json();
console.log('photos:', photos);

const preCount = photos.filter((p) => ['pre_tv_screen', 'pre_wall'].includes(p.slot)).length;
const postCount = photos.filter((p) => ['post_front', 'post_left', 'post_right'].includes(p.slot)).length;
console.log('preCount:', preCount, 'postCount:', postCount);

// complete_install_atomic 직접 호출
console.log('\n=== complete_install_atomic ===');
const rpcRes = await fetch(`${URL}/rest/v1/rpc/complete_install_atomic`, {
  method: 'POST',
  headers: driverHeaders,
  body: JSON.stringify({
    p_order_id: order.id,
    p_option_selected: 'C_no_drill',
    p_conversion: false,
    p_consent_confirmed: true,
    p_memo: '성공',
    p_photo_pre_count: preCount,
    p_photo_post_count: postCount,
  }),
});
console.log('status:', rpcRes.status);
console.log('body:', await rpcRes.text());
