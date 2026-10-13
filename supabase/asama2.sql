-- Supabase > SQL Editor'e yapıştırıp RUN yapın. (AŞAMA 2: lisans aktivasyon + uzatma anahtarı + geçmiş)
-- Aşama 1 SQL'i daha önce çalıştırılmış olmalı.

-- ============ TABLOLAR ============
create table public.license_keys (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  kind text not null check (kind in ('activation','extension')),
  key_hash text not null,                 -- anahtarın kendisi saklanmaz, sadece özeti (hash)
  key_hint text not null,                 -- listelemede göstermek için son 5 karakter
  duration_days int,                      -- uzatma anahtarı: kaç gün
  member_role text check (member_role in ('company_admin','weighbridge','purchasing')), -- aktivasyon kodu: verilecek rol
  max_uses int not null default 1,
  used_count int not null default 0,
  status text not null default 'active' check (status in ('active','used','revoked')),
  expires_at timestamptz,
  note text,
  used_by uuid references public.profiles(id) on delete set null,
  used_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index license_keys_hash_uidx on public.license_keys (key_hash);

create table public.activation_uses (
  id bigserial primary key,
  key_id uuid not null references public.license_keys(id) on delete cascade,
  company_id uuid not null,
  user_id uuid references public.profiles(id) on delete set null,
  used_at timestamptz not null default now()
);

create table public.license_events (
  id bigserial primary key,
  company_id uuid,
  event_type text not null,
  user_id uuid references public.profiles(id) on delete set null,
  old_end timestamptz,
  new_end timestamptz,
  details jsonb,
  created_at timestamptz not null default now()
);
create index license_events_company_idx on public.license_events (company_id, created_at desc);

-- ============ YARDIMCI FONKSİYONLAR ============
create or replace function public.norm_key(p text) returns text
language sql immutable as $$ select upper(regexp_replace(coalesce(p, ''), '[\s-]+', '', 'g')) $$;

create or replace function public.hash_key(p_company uuid, p_key text) returns text
language sql immutable as $$
  select encode(sha256(convert_to(p_company::text || ':' || public.norm_key(p_key), 'UTF8')), 'hex')
$$;

create or replace function public.too_many_attempts() returns boolean
language sql stable security definer set search_path = public as $$
  select count(*) >= 5 from public.license_events
  where user_id = auth.uid() and event_type = 'failed_attempt' and created_at > now() - interval '15 minutes'
$$;

create or replace function public.log_failed(p_company uuid, p_kind text) returns void
language sql security definer set search_path = public as $$
  insert into public.license_events (company_id, event_type, user_id, details)
  values (p_company, 'failed_attempt', auth.uid(), jsonb_build_object('kind', p_kind))
$$;

-- ============ ANAHTAR ÜRETME (sadece süper yönetici, sunucuda) ============
create or replace function public.create_license_key(
  p_company uuid, p_kind text, p_days int, p_role text, p_max_uses int, p_expires timestamptz, p_note text
) returns text
language plpgsql security definer set search_path = public as $$
declare raw text; r20 text; k text;
begin
  if not public.is_super_admin() then raise exception 'Bu işlem için yetkiniz yok.'; end if;
  if not exists (select 1 from public.companies where id = p_company) then raise exception 'Firma bulunamadı.'; end if;
  if p_kind not in ('activation', 'extension') then raise exception 'Geçersiz anahtar türü.'; end if;
  if p_kind = 'extension' then
    if p_days is null or p_days < 1 or p_days > 3650 then raise exception 'Uzatma süresi 1 ile 3650 gün arasında olmalı.'; end if;
    p_max_uses := 1; p_role := null;
  else
    if p_role is null or p_role not in ('company_admin','weighbridge','purchasing') then raise exception 'Geçersiz rol.'; end if;
    if p_max_uses is null or p_max_uses < 1 then p_max_uses := 1; end if;
    p_days := null;
  end if;
  raw := upper(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''));
  r20 := substr(raw, 1, 12) || substr(raw, 33, 8);
  k := (case when p_kind = 'extension' then 'EXT' else 'ACT' end)
       || '-' || substr(r20, 1, 5) || '-' || substr(r20, 6, 5) || '-' || substr(r20, 11, 5) || '-' || substr(r20, 16, 5);
  insert into public.license_keys (company_id, kind, key_hash, key_hint, duration_days, member_role, max_uses, expires_at, note, created_by)
  values (p_company, p_kind, public.hash_key(p_company, k), right(k, 5), p_days, p_role, p_max_uses, p_expires, nullif(p_note, ''), auth.uid());
  insert into public.license_events (company_id, event_type, user_id, details)
  values (p_company, 'key_created', auth.uid(), jsonb_build_object('kind', p_kind, 'days', p_days, 'hint', right(k, 5)));
  return k;
end $$;

create or replace function public.revoke_license_key(p_key uuid) returns void
language plpgsql security definer set search_path = public as $$
declare kr public.license_keys%rowtype;
begin
  if not public.is_super_admin() then raise exception 'Bu işlem için yetkiniz yok.'; end if;
  update public.license_keys set status = 'revoked' where id = p_key and status = 'active' returning * into kr;
  if found then
    insert into public.license_events (company_id, event_type, user_id, details)
    values (kr.company_id, 'key_revoked', auth.uid(), jsonb_build_object('kind', kr.kind, 'hint', kr.key_hint));
  end if;
end $$;

-- ============ LİSANS UZATMA (firma yöneticisi, sunucuda doğrulanır) ============
create or replace function public.redeem_extension_key(p_company uuid, p_key text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c public.companies%rowtype; kr public.license_keys%rowtype; v_old timestamptz; v_new timestamptz;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'Oturum açmanız gerekiyor.'); end if;
  if not public.is_company_admin(p_company) then
    return jsonb_build_object('ok', false, 'error', 'Lisans anahtarını yalnızca firma yöneticisi girebilir.');
  end if;
  if public.too_many_attempts() then
    return jsonb_build_object('ok', false, 'error', 'Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin.');
  end if;
  select * into c from public.companies where id = p_company for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'Firma bulunamadı.'); end if;
  if c.status <> 'active' then
    return jsonb_build_object('ok', false, 'error', 'Firma erişimi kapalı. Yazılım yöneticisiyle iletişime geçin.');
  end if;
  select * into kr from public.license_keys
   where kind = 'extension' and company_id = p_company and key_hash = public.hash_key(p_company, p_key) for update;
  if not found or kr.status <> 'active' or kr.used_count >= kr.max_uses
     or (kr.expires_at is not null and kr.expires_at < now()) then
    perform public.log_failed(p_company, 'extension');
    return jsonb_build_object('ok', false, 'error', 'Anahtar geçersiz, daha önce kullanılmış ya da süresi dolmuş.');
  end if;
  v_old := c.license_end;
  if v_old > now() then v_new := v_old + make_interval(days => kr.duration_days);   -- kalan sürenin üzerine ekle
  else v_new := now() + make_interval(days => kr.duration_days);                    -- süre dolmuşsa bugünden başlat
  end if;
  perform set_config('app.skip_license_log', '1', true);
  update public.companies
     set license_end = v_new, license_start = case when v_old > now() then license_start else now() end
   where id = p_company;
  update public.license_keys set used_count = used_count + 1, status = 'used', used_by = auth.uid(), used_at = now() where id = kr.id;
  insert into public.license_events (company_id, event_type, user_id, old_end, new_end, details)
  values (p_company, 'extended', auth.uid(), v_old, v_new, jsonb_build_object('days', kr.duration_days, 'hint', kr.key_hint));
  return jsonb_build_object('ok', true, 'new_end', v_new);
end $$;

-- ============ İLK KULLANICI AKTİVASYONU ============
create or replace function public.activate_membership(p_company uuid, p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c public.companies%rowtype; kr public.license_keys%rowtype; m public.memberships%rowtype;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'Oturum açmanız gerekiyor.'); end if;
  if public.too_many_attempts() then
    return jsonb_build_object('ok', false, 'error', 'Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin.');
  end if;
  select * into c from public.companies where id = p_company;
  if not found then return jsonb_build_object('ok', false, 'error', 'Firma bulunamadı.'); end if;
  if c.status <> 'active' or c.license_end <= now() then
    return jsonb_build_object('ok', false, 'error', 'Firmanın lisansı aktif değil. Firma yöneticisiyle iletişime geçin.');
  end if;
  select * into m from public.memberships where company_id = p_company and user_id = auth.uid();
  if found then
    if m.active then return jsonb_build_object('ok', true); end if;
    return jsonb_build_object('ok', false, 'error', 'Hesabınız firma yöneticisi tarafından pasife alınmış.');
  end if;
  select * into kr from public.license_keys
   where kind = 'activation' and company_id = p_company and key_hash = public.hash_key(p_company, p_code) for update;
  if not found or kr.status <> 'active' or kr.used_count >= kr.max_uses
     or (kr.expires_at is not null and kr.expires_at < now()) then
    perform public.log_failed(p_company, 'activation');
    return jsonb_build_object('ok', false, 'error', 'Aktivasyon kodu geçersiz, kullanım hakkı bitmiş ya da süresi dolmuş.');
  end if;
  insert into public.memberships (company_id, user_id, role, active) values (p_company, auth.uid(), kr.member_role, true);
  update public.license_keys
     set used_count = used_count + 1,
         status = case when used_count + 1 >= max_uses then 'used' else status end,
         used_by = auth.uid(), used_at = now()
   where id = kr.id;
  insert into public.activation_uses (key_id, company_id, user_id) values (kr.id, p_company, auth.uid());
  insert into public.license_events (company_id, event_type, user_id, details)
  values (p_company, 'activation_used', auth.uid(), jsonb_build_object('hint', kr.key_hint, 'role', kr.member_role));
  return jsonb_build_object('ok', true);
end $$;

-- ============ LİSANS DEĞİŞİKLİKLERİNİ OTOMATİK KAYDET ============
create or replace function public.log_company_license() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('app.skip_license_log', true), '') = '1' then return new; end if;
  if tg_op = 'INSERT' then
    insert into public.license_events (company_id, event_type, user_id, new_end, details)
    values (new.id, 'company_created', auth.uid(), new.license_end, jsonb_build_object('name', new.name));
  elsif new.license_end is distinct from old.license_end or new.status is distinct from old.status then
    insert into public.license_events (company_id, event_type, user_id, old_end, new_end, details)
    values (new.id, 'manual_change', auth.uid(), old.license_end, new.license_end,
            jsonb_build_object('old_status', old.status, 'new_status', new.status));
  end if;
  return new;
end $$;
create trigger companies_license_log after insert or update on public.companies
for each row execute function public.log_company_license();

-- ============ YETKİLER (RLS) ============
alter table public.license_keys enable row level security;
alter table public.activation_uses enable row level security;
alter table public.license_events enable row level security;

create policy license_keys_select on public.license_keys for select using (public.is_super_admin());
create policy activation_uses_select on public.activation_uses for select
  using (public.is_super_admin() or public.is_company_admin(company_id));
create policy license_events_select on public.license_events for select
  using (public.is_super_admin()
         or (company_id is not null and public.is_company_admin(company_id)
             and event_type in ('company_created','manual_change','extended','activation_used')));
-- Yazma işlemleri yalnızca yukarıdaki güvenli fonksiyonlarla yapılır; doğrudan ekleme/silme/güncelleme yoktur.
