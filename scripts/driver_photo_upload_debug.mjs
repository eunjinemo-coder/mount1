// driver access_token으로 storage upload + photos INSERT 직접 시뮬
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
console.log('target:', target);

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
const driverHeaders = { apikey: ANON, Authorization: `Bearer ${access_token}` };

// 본인 주문 1개
const ordRes = await fetch(`${URL}/rest/v1/orders?select=id&limit=1`, { headers: driverHeaders });
const [order] = await ordRes.json();
console.log('order:', order);

if (!order?.id) process.exit(0);

// 1x1 PNG dummy bytes
const png = Buffer.from(
  '89504E470D0A1A0A0000000D49484452000000010000000108020000004B6D29DC0000000C49444154789C636060000000040001D70F18C70000000049454E44AE426082',
  'hex'
);

const objectPath = `${target.id}/${order.id}/pre_tv_screen.png`;
console.log('\n=== Storage upload ===');
console.log('path:', objectPath);

const upRes = await fetch(`${URL}/storage/v1/object/photos-hot/${objectPath}`, {
  method: 'POST',
  headers: { ...driverHeaders, 'Content-Type': 'image/png', 'x-upsert': 'true' },
  body: png,
});
console.log('status:', upRes.status);
const upBody = await upRes.text();
console.log('body:', upBody.slice(0, 500));

if (upRes.status >= 400) {
  console.log('\n❌ Storage upload 실패 — RLS 또는 버킷 문제');
  process.exit(1);
}

// signedUrl 생성
console.log('\n=== signed URL ===');
const signedRes = await fetch(`${URL}/storage/v1/object/sign/photos-hot/${objectPath}`, {
  method: 'POST',
  headers: { ...driverHeaders, 'Content-Type': 'application/json' },
  body: JSON.stringify({ expiresIn: 3600 }),
});
console.log('status:', signedRes.status);
console.log('body:', (await signedRes.text()).slice(0, 300));

// photos INSERT
console.log('\n=== photos table INSERT ===');
const insertRes = await fetch(`${URL}/rest/v1/photos`, {
  method: 'POST',
  headers: { ...driverHeaders, 'Content-Type': 'application/json', Prefer: 'return=representation' },
  body: JSON.stringify({
    order_id: order.id,
    technician_id: target.id,
    slot: 'pre_tv_screen',
    storage_tier: 'hot',
    supabase_path: objectPath,
    mime_type: 'image/png',
    size_bytes: png.length,
  }),
});
console.log('status:', insertRes.status);
console.log('body:', (await insertRes.text()).slice(0, 400));

console.log('\n=== 종합 ===');
console.log(`storage upload: ${upRes.status}`);
console.log(`signed url: ${signedRes.status}`);
console.log(`photos INSERT: ${insertRes.status}`);
