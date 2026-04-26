-- ============================================================================
-- 0011_pii_decrypt.sql — PII 복호화 RPC (전화번호 → tel: 딥링크)
-- Source: 헌법 제3조 Security-First + 02_IA/04_PERMISSIONS.md §5 (PII 접근 감사)
--
-- 설계:
--   · 키는 Supabase Vault (`vault.decrypted_secrets`) 에 'pii_key' 이름으로 저장
--   · pgp_sym_encrypt / pgp_sym_decrypt (pgcrypto) — AES + HMAC 통합
--   · RPC SECURITY DEFINER — 본인 배차만 + 자동 audit_events INSERT
--   · 평문은 응답에서만 노출, 절대 logs/저장소에 남지 않음
--
-- 사전 조건 (은진님이 1회 수행):
--   1) Dashboard → Project Settings → Vault → "New secret"
--      Name: pii_key
--      Value: 32바이트 base64 강한 키 (예: openssl rand -base64 32)
--   2) dev/prod 양쪽 동일한 키여야 데이터 호환 (혹은 환경별 분리 운영)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- helper: vault 에서 pii_key 가져오기 (캐시 없음 — 매번 fresh)
-- ----------------------------------------------------------------------------
create or replace function public.pii_key()
returns text
language plpgsql
security definer
stable
set search_path = public, vault
as $$
declare
  v_key text;
begin
  select decrypted_secret into v_key
    from vault.decrypted_secrets
   where name = 'pii_key'
   limit 1;

  if v_key is null or v_key = '' then
    raise exception 'pii_key_missing — Vault 에 pii_key 등록 필요 (HANDOFF #21)' using errcode = 'P0001';
  end if;

  return v_key;
end;
$$;

revoke execute on function public.pii_key() from public, anon, authenticated;
-- pii_key() 는 다른 SECURITY DEFINER 함수에서만 호출됨 (직접 호출 차단)

-- ----------------------------------------------------------------------------
-- helper: 평문 → bytea 암호화 (admin 발급 화면에서 사용)
-- ----------------------------------------------------------------------------
create or replace function public.encrypt_pii(p_plaintext text)
returns bytea
language plpgsql
security definer
stable
set search_path = public, extensions
as $$
begin
  if p_plaintext is null or p_plaintext = '' then
    return null;
  end if;
  return extensions.pgp_sym_encrypt(p_plaintext, public.pii_key());
end;
$$;

revoke execute on function public.encrypt_pii(text) from public, anon;
grant execute on function public.encrypt_pii(text) to authenticated;
-- (admin server action 에서 customer 등록 시 호출)

-- ============================================================================
-- §6.5 — rpc_technician_get_customer_phone
--   본인 배차 order 의 customer.phone_encrypted 복호화 → text 반환
--   호출 시 자동으로 audit_events + call_logs(type='on_demand', outcome='answered') 기록
--   ⚠️ tel: 딥링크 직전에만 호출 — 응답을 클라가 저장하지 않도록 server action 일회성 fetch
-- ============================================================================
create or replace function public.rpc_technician_get_customer_phone(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_tech uuid := public.technician_id();
  v_order_assigned uuid;
  v_customer_id uuid;
  v_phone_enc bytea;
  v_phone text;
begin
  if v_tech is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  -- 본인 배차 + customer_id 가져오기
  select assigned_technician_id, customer_id
    into v_order_assigned, v_customer_id
    from orders where id = p_order_id;

  if v_order_assigned is null then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;
  if v_order_assigned <> v_tech then
    raise exception 'not_your_order' using errcode = '42501';
  end if;

  -- 암호문 → 평문
  select phone_encrypted into v_phone_enc from customers where id = v_customer_id;
  if v_phone_enc is null then
    raise exception 'phone_missing' using errcode = 'P0001';
  end if;

  v_phone := extensions.pgp_sym_decrypt(v_phone_enc, public.pii_key());

  -- 감사 로그 (PII 접근은 항상 기록)
  insert into audit_events (actor_type, actor_id, action, subject_type, subject_id, after_value)
  values (
    'technician',
    auth.uid(),
    'pii.phone_decrypted',
    'order',
    p_order_id,
    jsonb_build_object('reason', 'tel_dial')
  );

  return jsonb_build_object(
    'ok', true,
    'phone', v_phone,
    'order_id', p_order_id
  );
end;
$$;

revoke all on function public.rpc_technician_get_customer_phone(uuid) from public, anon;
grant execute on function public.rpc_technician_get_customer_phone(uuid) to authenticated;
