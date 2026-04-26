-- ============================================================================
-- 0012_recommend.sql — 배차 추천 점수 알고리즘 (B05)
-- Source: 02_IA/06_RECOMMEND_ALGORITHM.md (와이어프레임 B05 추천 카드)
--
-- 점수 (0~100):
--   거리(0~30)  + 등급(0~20)  + 부하(0~25)  + 선호지역(0~10)  + 공정성(0~15)
--
-- 호출 권한: dispatch_admin · super_admin (배차 결정용 — 비공개)
-- 부수효과 없음 (read-only) — RPC 라기보다 SQL view 의 매개변수화 버전
-- ============================================================================

-- Haversine — 두 좌표 간 거리(km). 모든 입력 NULL 이면 NULL.
create or replace function public.haversine_km(
  lat1 numeric, lng1 numeric, lat2 numeric, lng2 numeric
) returns numeric
language sql
immutable
as $$
  select case
    when lat1 is null or lng1 is null or lat2 is null or lng2 is null then null
    else 6371 * 2 * asin(sqrt(
      power(sin(radians((lat2 - lat1) / 2)), 2)
      + cos(radians(lat1)) * cos(radians(lat2))
        * power(sin(radians((lng2 - lng1) / 2)), 2)
    ))
  end;
$$;

-- ============================================================================
-- §B05 — rpc_admin_recommend_technicians
--   p_order_id 주문에 대해 활성 기사 점수 정렬 LIMIT p_limit
-- ============================================================================
create or replace function public.rpc_admin_recommend_technicians(
  p_order_id uuid,
  p_limit int default 5
) returns table (
  technician_id uuid,
  display_name text,
  grade text,
  score numeric,
  distance_km numeric,
  today_load int,
  weekly_load int,
  preferred_match boolean,
  score_breakdown jsonb
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_actor_role text := public.admin_role();
  v_order_lat numeric;
  v_order_lng numeric;
  v_order_region text;
  v_avg_weekly numeric;
begin
  if v_actor_role not in ('super_admin', 'dispatch_admin') then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  -- 주문 좌표 + 지역 (customer 경유)
  select c.address_lat, c.address_lng, c.address_region_sigungu
    into v_order_lat, v_order_lng, v_order_region
    from orders o
    join customers c on c.id = o.customer_id
   where o.id = p_order_id;

  if not found then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;

  -- 공정성: 활성 기사들의 최근 7일 평균 배차 수
  select coalesce(avg(cnt), 0)
    into v_avg_weekly
    from (
      select count(*) as cnt
        from orders o
        join technicians t on t.id = o.assigned_technician_id
       where t.status = 'active'
         and o.assigned_at >= now() - interval '7 days'
       group by t.id
    ) sub;

  return query
  with tech_stats as (
    select
      t.id,
      t.display_name,
      t.grade,
      t.preferred_regions,
      t.daily_max_jobs,
      public.haversine_km(t.last_known_lat, t.last_known_lng, v_order_lat, v_order_lng) as dist,
      (
        select count(*) from orders o2
         where o2.assigned_technician_id = t.id
           and o2.assigned_at::date = current_date
      )::int as load_today,
      (
        select count(*) from orders o3
         where o3.assigned_technician_id = t.id
           and o3.assigned_at >= now() - interval '7 days'
      )::int as load_weekly,
      (v_order_region = any(t.preferred_regions)) as pref_match
    from technicians t
    where t.status = 'active'
  ),
  scored as (
    select
      ts.id,
      ts.display_name,
      ts.grade,
      ts.dist,
      ts.load_today,
      ts.load_weekly,
      ts.pref_match,
      -- 거리 점수 (0~30): 0km=30, 30km+=0
      case
        when ts.dist is null then 5    -- 위치 unknown 시 중립값
        when ts.dist <= 30 then greatest(0, 30 - ts.dist)
        else 0
      end as s_dist,
      -- 등급 점수 (0~20)
      case ts.grade
        when 'gold' then 20
        when 'silver' then 15
        when 'bronze' then 10
        else 5
      end as s_grade,
      -- 부하 점수 (0~25): 오늘 배차 적을수록 높음. daily_max_jobs 기반 비율.
      case
        when ts.load_today >= ts.daily_max_jobs then 0
        else round(25 * (1 - ts.load_today::numeric / nullif(ts.daily_max_jobs, 0)), 2)
      end as s_load,
      -- 선호 지역 매치 (0/10)
      case when ts.pref_match then 10 else 0 end as s_pref,
      -- 공정성 점수 (0~15): 평균보다 적을수록 높음 (Gini 보정)
      case
        when v_avg_weekly = 0 then 15
        when ts.load_weekly < v_avg_weekly then round(15 * (1 - ts.load_weekly / v_avg_weekly), 2)
        else 0
      end as s_fair
    from tech_stats ts
  )
  select
    s.id,
    s.display_name,
    s.grade,
    (s.s_dist + s.s_grade + s.s_load + s.s_pref + s.s_fair)::numeric as score,
    s.dist,
    s.load_today,
    s.load_weekly,
    s.pref_match,
    jsonb_build_object(
      'distance', s.s_dist,
      'grade', s.s_grade,
      'load', s.s_load,
      'preferred_region', s.s_pref,
      'fairness', s.s_fair
    )
  from scored s
  -- 일일 한도 초과 기사는 제외 (부하 0인 케이스 자동 차단)
  where s.s_load > 0 or s.load_today = 0
  order by score desc, s.dist asc nulls last
  limit greatest(1, least(p_limit, 20));
end;
$$;

revoke all on function public.rpc_admin_recommend_technicians(uuid, int) from public, anon;
grant execute on function public.rpc_admin_recommend_technicians(uuid, int) to authenticated;
