-- ============================================================================
-- 0003_cron.sql — pg_cron 스케줄
-- Source of truth: 05_TECH_STACK/03_BACKEND_SUPABASE.md §7.1
-- 대상: 3 스케줄 + stub 함수 3종
-- 실제 알고리즘 본문은 Sprint M-X 마이그레이션에서 REPLACE.
-- ============================================================================

-- pg_cron 활성화 (Supabase Pro 이상에서 사용 가능)
create extension if not exists pg_cron with schema extensions;

-- ============================================================================
-- stub 함수 3종
--   현재는 실행 기록(audit_events)만 남기는 placeholder.
--   각 본문은 다음 세션에서 구현 후 REPLACE:
--     · generate_next_day_preview  → 07_DISPATCH_ALGORITHM.md
--     · calc_gini_and_notify       → 07_DISPATCH_ALGORITHM.md §Gini
--     · migrate_photo_tiers        → Sprint M-6 (R2 lifecycle Edge Function 연계)
-- ============================================================================

create or replace function public.generate_next_day_preview()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into audit_events (actor_type, action, subject_type, subject_id, after_value)
  values (
    'system',
    'cron.dispatch_preview',
    'system',
    gen_random_uuid(),
    jsonb_build_object('ran_at', now(), 'status', 'stub', 'note', 'TODO Sprint M-X 배차 프리뷰')
  );
end;
$$;

create or replace function public.calc_gini_and_notify()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into audit_events (actor_type, action, subject_type, subject_id, after_value)
  values (
    'system',
    'cron.weekly_gini',
    'system',
    gen_random_uuid(),
    jsonb_build_object('ran_at', now(), 'status', 'stub', 'note', 'TODO Sprint M-5 Gini 계산')
  );
end;
$$;

create or replace function public.migrate_photo_tiers()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hot_days int;
  v_candidates int;
begin
  -- Hot → Warm 후보 카운트만 기록 (실제 R2 이관은 Edge Function 트리거 영역)
  select coalesce((value)::text::int, 90)
  into v_hot_days
  from app_settings
  where key = 'photo_lifecycle_hot_days';

  select count(*) into v_candidates
  from photos
  where storage_tier = 'hot'
    and uploaded_at < now() - (v_hot_days || ' days')::interval;

  insert into audit_events (actor_type, action, subject_type, subject_id, after_value)
  values (
    'system',
    'cron.photo_lifecycle',
    'system',
    gen_random_uuid(),
    jsonb_build_object(
      'ran_at', now(),
      'status', 'stub',
      'hot_days', v_hot_days,
      'warm_candidates', v_candidates,
      'note', 'TODO Sprint M-6 R2 lifecycle 이관'
    )
  );
end;
$$;

-- 보안 — 직접 호출 금지, pg_cron 만 실행
revoke all on function public.generate_next_day_preview from public, anon, authenticated;
revoke all on function public.calc_gini_and_notify       from public, anon, authenticated;
revoke all on function public.migrate_photo_tiers        from public, anon, authenticated;

-- ============================================================================
-- 스케줄 등록 (BACKEND_SUPABASE §7.1)
--   시간대는 Supabase DB timezone(UTC) 기준이지만 cron 표현식에 KST 오프셋을 반영해
--   실제 KST 의도 시각을 맞춘다. (UTC = KST - 9h)
--     · dispatch-preview-next-day : 매일 KST 00:00 = UTC 15:00 (전일)
--     · weekly-gini-calc          : 매주 KST 일 23:00 = UTC 일 14:00
--     · photo-tier-migration      : 매일 KST 04:00 = UTC 19:00 (전일)
-- ============================================================================

select cron.schedule(
  'dispatch-preview-next-day',
  '0 15 * * *',
  $$select public.generate_next_day_preview();$$
);

select cron.schedule(
  'weekly-gini-calc',
  '0 14 * * 0',
  $$select public.calc_gini_and_notify();$$
);

select cron.schedule(
  'photo-tier-migration',
  '0 19 * * *',
  $$select public.migrate_photo_tiers();$$
);
