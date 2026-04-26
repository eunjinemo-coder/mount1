-- ============================================================================
-- 0010_realtime_publication.sql — Realtime 구독 대상 테이블 등록 (멱등)
-- Source: R8 admin AutoRefresh polling → postgres_changes 전환
--
-- supabase_realtime publication 에 추가된 테이블만 클라이언트에서
-- channel().on('postgres_changes', { table: '...' }) 으로 구독 가능.
-- RLS 가 그대로 적용되어 권한 없는 row 변경은 발신되지 않음.
-- ============================================================================

do $$
declare
  v_table text;
  v_tables text[] := array['orders', 'installations', 'issues'];
begin
  -- publication 이 없으면 생성 (Supabase 는 기본 제공, self-host/dev reset 안전망)
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  -- 각 테이블을 멱등 추가 (이미 등록되어 있으면 skip)
  foreach v_table in array v_tables loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end $$;
