// 진단 + fix: v_technician_today timezone 처리
// 실행: node scripts/fix_today_view_kst.mjs

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
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 1. 진단: 현재 시간 + 테스트 주문의 scheduled date 비교
const diag = await fetch(`${URL}/rest/v1/rpc/exec_sql`, {
  method: 'POST',
  headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sql: `select
      now() as utc_now,
      current_date as utc_date,
      (now() at time zone 'Asia/Seoul')::date as kst_date,
      o.scheduled_installation_at,
      o.scheduled_installation_at::date as sched_date_utc,
      (o.scheduled_installation_at at time zone 'Asia/Seoul')::date as sched_date_kst,
      o.scheduled_installation_at::date = current_date as utc_match,
      (o.scheduled_installation_at at time zone 'Asia/Seoul')::date = (now() at time zone 'Asia/Seoul')::date as kst_match
    from orders o
    where o.coupang_order_id like 'TEST-%'
    order by o.created_at desc limit 1`,
  }),
});
console.log('진단 RPC status:', diag.status);
// exec_sql RPC가 없을 수 있음 — 다른 방식 시도

// 2. orders 직접 호출 (REST)로 scheduled_installation_at 가져오기
const ordRes = await fetch(`${URL}/rest/v1/orders?coupang_order_id=like.TEST-*&select=id,scheduled_installation_at,status&order=created_at.desc&limit=1`, {
  headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
});
const orders = await ordRes.json();
console.log('테스트 주문:', orders);

if (orders.length > 0) {
  const sched = new Date(orders[0].scheduled_installation_at);
  const now = new Date();
  console.log('\n=== 시간대 분석 ===');
  console.log('지금 (UTC):', now.toISOString());
  console.log('지금 (KST):', new Date(now.getTime() + 9 * 3600 * 1000).toISOString());
  console.log('scheduled (UTC):', sched.toISOString());
  console.log('scheduled (KST):', new Date(sched.getTime() + 9 * 3600 * 1000).toISOString());
  console.log('UTC 날짜 같음?', sched.toISOString().slice(0, 10) === now.toISOString().slice(0, 10));

  const kstNow = new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const kstSched = new Date(sched.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  console.log('KST 날짜 같음?', kstSched === kstNow);
}

// 3. view recreate — KST timezone 사용
console.log('\n=== view recreate (KST timezone) ===');
const viewSql = `
create or replace view public.v_technician_today as
select
  o.id as order_id,
  o.assigned_technician_id,
  o.scheduled_installation_at,
  o.status,
  c.phone_tail4,
  coalesce(c.address_region_sido, '') || ' ' || coalesce(c.address_region_sigungu, '') as region,
  coalesce(o.tv_brand, '') || ' ' || coalesce(o.tv_model, '') as tv,
  exists (
    select 1 from public.call_logs cl
    where cl.order_id = o.id
      and cl.type = 'pre_arrival_30min'
  ) as pre_call_done,
  (select count(*) from public.photos p where p.order_id = o.id) as photo_count
from public.orders o
join public.v_customer_for_technician c on c.id = o.customer_id
where (o.scheduled_installation_at at time zone 'Asia/Seoul')::date = (now() at time zone 'Asia/Seoul')::date
  and o.status in ('assigned','en_route','on_site','in_progress');
`;

// supabase REST는 DDL 실행 안 함. SQL Editor 또는 Management API 사용.
// 사용자에게 SQL Editor에서 실행하도록 출력.
console.log('\n다음 SQL을 Supabase SQL Editor에서 실행:\n');
console.log(viewSql);
console.log('\n그 후 driver 시크릿 창 새 로그인 → /today 카드 표시 확인');
