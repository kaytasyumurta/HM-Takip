-- Supabase > SQL Editor'e yapıştırıp RUN yapın. (AŞAMA 3: başvuru/onay, 15 gün deneme, tedarik modülü)
-- Aşama 1 ve 2 SQL'leri daha önce çalıştırılmış olmalı.

-- ============ 1) HER YENİ FİRMAYA 15 GÜNLÜK DENEME ============
alter table public.companies alter column license_end set default (now() + interval '15 days');

create or replace function public.set_trial_license() returns trigger
language plpgsql as $$
begin
  new.license_start := now();
  new.license_end := now() + interval '15 days';
  return new;
end $$;
drop trigger if exists companies_trial on public.companies;
create trigger companies_trial before insert on public.companies
for each row execute function public.set_trial_license();

-- ============ 2) AKTİVASYON KODU YERİNE BAŞVURU / ONAY ============
drop function if exists public.activate_membership(uuid, text);

create table public.join_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  assigned_role text check (assigned_role in ('company_admin','weighbridge','purchasing')),
  requested_at timestamptz not null default now(),
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz
);
create unique index join_requests_pending_uidx on public.join_requests (company_id, user_id) where status = 'pending';

create or replace function public.has_pending_request_to_my_company(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.join_requests jr
                 where jr.user_id = uid and jr.status = 'pending' and public.is_company_admin(jr.company_id))
$$;

-- yöneticiler, kendi firmasına başvuranın adını/e-postasını görebilsin
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.is_super_admin() or public.shares_company_admin(id)
         or public.has_pending_request_to_my_company(id));

alter table public.join_requests enable row level security;
create policy join_requests_select on public.join_requests for select
  using (user_id = auth.uid() or public.is_super_admin() or public.is_company_admin(company_id));

create or replace function public.request_to_join(p_company uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c public.companies%rowtype; m public.memberships%rowtype; n int;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'Oturum açmanız gerekiyor.'); end if;
  select * into c from public.companies where id = p_company;
  if not found or c.status <> 'active' then
    return jsonb_build_object('ok', false, 'error', 'Firma bulunamadı veya erişimi kapalı.');
  end if;
  select * into m from public.memberships where company_id = p_company and user_id = auth.uid();
  if found then
    if m.active then return jsonb_build_object('ok', true, 'state', 'member'); end if;
    return jsonb_build_object('ok', false, 'error', 'Hesabınız firma yöneticisi tarafından pasife alınmış.');
  end if;
  if exists (select 1 from public.join_requests where company_id = p_company and user_id = auth.uid() and status = 'pending') then
    return jsonb_build_object('ok', true, 'state', 'pending');
  end if;
  select count(*) into n from public.join_requests where user_id = auth.uid() and requested_at > now() - interval '24 hours';
  if n >= 5 then return jsonb_build_object('ok', false, 'error', 'Çok fazla başvuru yaptınız. Daha sonra tekrar deneyin.'); end if;
  insert into public.join_requests (company_id, user_id) values (p_company, auth.uid());
  return jsonb_build_object('ok', true, 'state', 'requested');
end $$;

create or replace function public.decide_join_request(p_request uuid, p_approve boolean, p_role text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.join_requests%rowtype;
begin
  select * into r from public.join_requests where id = p_request for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'Başvuru bulunamadı.'); end if;
  if not (public.is_super_admin() or public.is_company_admin(r.company_id)) then
    return jsonb_build_object('ok', false, 'error', 'Bu işlem için yetkiniz yok.');
  end if;
  if r.status <> 'pending' then return jsonb_build_object('ok', false, 'error', 'Bu başvuru zaten sonuçlandırılmış.'); end if;
  if p_approve then
    if p_role is null or p_role not in ('company_admin','weighbridge','purchasing') then
      return jsonb_build_object('ok', false, 'error', 'Geçersiz rol.');
    end if;
    insert into public.memberships (company_id, user_id, role, active) values (r.company_id, r.user_id, p_role, true)
    on conflict (company_id, user_id) do update set role = excluded.role, active = true;
    update public.join_requests set status = 'approved', assigned_role = p_role, decided_by = auth.uid(), decided_at = now() where id = p_request;
  else
    update public.join_requests set status = 'rejected', decided_by = auth.uid(), decided_at = now() where id = p_request;
  end if;
  return jsonb_build_object('ok', true);
end $$;

create trigger join_requests_audit after insert or update or delete on public.join_requests
for each row execute function public.audit_trigger();

-- Artık yalnızca lisans UZATMA anahtarı üretilir (aktivasyon kodu kaldırıldı)
create or replace function public.create_license_key(
  p_company uuid, p_kind text, p_days int, p_role text, p_max_uses int, p_expires timestamptz, p_note text
) returns text
language plpgsql security definer set search_path = public as $$
declare raw text; r20 text; k text;
begin
  if not public.is_super_admin() then raise exception 'Bu işlem için yetkiniz yok.'; end if;
  if not exists (select 1 from public.companies where id = p_company) then raise exception 'Firma bulunamadı.'; end if;
  if p_kind <> 'extension' then raise exception 'Yalnızca lisans uzatma anahtarı üretilebilir.'; end if;
  if p_days is null or p_days < 1 or p_days > 3650 then raise exception 'Uzatma süresi 1 ile 3650 gün arasında olmalı.'; end if;
  raw := upper(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''));
  r20 := substr(raw, 1, 12) || substr(raw, 33, 8);
  k := 'EXT-' || substr(r20, 1, 5) || '-' || substr(r20, 6, 5) || '-' || substr(r20, 11, 5) || '-' || substr(r20, 16, 5);
  insert into public.license_keys (company_id, kind, key_hash, key_hint, duration_days, member_role, max_uses, expires_at, note, created_by)
  values (p_company, 'extension', public.hash_key(p_company, k), right(k, 5), p_days, null, 1, p_expires, nullif(p_note, ''), auth.uid());
  insert into public.license_events (company_id, event_type, user_id, details)
  values (p_company, 'key_created', auth.uid(), jsonb_build_object('kind', 'extension', 'days', p_days, 'hint', right(k, 5)));
  return k;
end $$;

-- ============ 3) OPERASYON YETKİ YARDIMCISI ============
-- Kullanıcı firmanın aktif üyesi + firma aktif + lisans bitmemiş + rolü listede ise firma kimliğini döndürür
create or replace function public.my_ops_companies(p_roles text[]) returns setof uuid
language sql stable security definer set search_path = public as $$
  select m.company_id from public.memberships m join public.companies c on c.id = m.company_id
  where m.user_id = auth.uid() and m.active and m.role = any (p_roles)
    and c.status = 'active' and c.license_end > now()
$$;

-- ============ 4) TEDARİKÇİLER VE ÜRÜNLER ============
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null, contact_person text, phone text, email text, city text, tax_no text, address text, notes text,
  active boolean not null default true,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (id, company_id)
);
create unique index suppliers_name_uidx on public.suppliers (company_id, lower(name));

create table public.products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null, code text, unit text not null default 'ton', notes text,
  active boolean not null default true,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (id, company_id)
);
create unique index products_name_uidx on public.products (company_id, lower(name));

-- ============ 5) TEDARİK EMİRLERİ ============
create table public.supply_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  order_no int not null,
  supplier_id uuid not null,
  product_id uuid not null,
  planned_qty numeric(14,3) not null check (planned_qty > 0),          -- ton
  unit_price numeric(14,4) not null check (unit_price >= 0),
  price_unit text not null default 'TL/ton' check (price_unit in ('TL/ton','TL/kg')),
  vat_rate numeric(5,2) not null default 20 check (vat_rate between 0 and 100),
  vat_included boolean not null default false,
  freight_model text not null default 'separate' check (freight_model in ('separate','included','unknown')),
  freight_basis text check (freight_basis in ('per_vehicle','per_ton','total')),
  freight_price numeric(14,2) check (freight_price >= 0),
  freight_vat_rate numeric(5,2) not null default 20 check (freight_vat_rate between 0 and 100),
  freight_vat_included boolean not null default false,
  start_date date not null default current_date,
  planned_end_date date,
  notes text,
  status text not null default 'active' check (status in ('draft','active','partial','completed','cancelled')),
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (company_id, order_no),
  -- tedarikçi ve ürün AYNI firmaya ait olmak zorunda (firmalar arası bağlantıyı veritabanı engeller)
  foreign key (supplier_id, company_id) references public.suppliers (id, company_id),
  foreign key (product_id, company_id) references public.products (id, company_id),
  -- nakliye çift hesaplanmasın: dahil/belirsiz modelde ayrı nakliye bedeli olamaz
  check (
    (freight_model = 'included' and freight_price is null and freight_basis is null) or
    (freight_model = 'unknown'  and freight_price is null and freight_basis is null) or
    (freight_model = 'separate' and freight_price is not null and freight_basis is not null)
  ),
  check (planned_end_date is null or planned_end_date >= start_date)
);

create or replace function public.set_order_no() returns trigger
language plpgsql security definer set search_path = public as $$
declare v int;
begin
  perform pg_advisory_xact_lock(hashtext('supply_orders:' || new.company_id::text));
  select coalesce(max(order_no), 0) + 1 into v from public.supply_orders where company_id = new.company_id;
  new.order_no := v;
  return new;
end $$;
create trigger supply_orders_no before insert on public.supply_orders
for each row execute function public.set_order_no();

-- nakliye değişiklik geçmişi
create table public.supply_freight_history (
  id bigserial primary key,
  order_id uuid not null references public.supply_orders(id) on delete cascade,
  company_id uuid not null,
  old_model text, new_model text, old_basis text, new_basis text, old_price numeric(14,2), new_price numeric(14,2),
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);

create or replace function public.log_freight_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.supply_freight_history (order_id, company_id, new_model, new_basis, new_price, changed_by)
    values (new.id, new.company_id, new.freight_model, new.freight_basis, new.freight_price, auth.uid());
  elsif new.freight_model is distinct from old.freight_model
     or new.freight_basis is distinct from old.freight_basis
     or new.freight_price is distinct from old.freight_price then
    insert into public.supply_freight_history (order_id, company_id, old_model, new_model, old_basis, new_basis, old_price, new_price, changed_by)
    values (new.id, new.company_id, old.freight_model, new.freight_model, old.freight_basis, new.freight_basis, old.freight_price, new.freight_price, auth.uid());
  end if;
  return new;
end $$;
create trigger supply_orders_freight_log after insert or update on public.supply_orders
for each row execute function public.log_freight_change();

-- ============ 6) YETKİLER (RLS) VE KAYITLAR ============
-- Görüntüleme: firmanın aktif üyeleri (lisans geçerliyse) | Yazma: firma yöneticisi ve satın alma/tedarik
do $$
declare t text;
begin
  foreach t in array array['suppliers','products','supply_orders'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%s_select" on public.%I for select using (company_id in (select public.my_ops_companies(array[''company_admin'',''purchasing'',''weighbridge''])))', t, t);
    execute format('create policy "%s_insert" on public.%I for insert with check (company_id in (select public.my_ops_companies(array[''company_admin'',''purchasing''])))', t, t);
    execute format('create policy "%s_update" on public.%I for update using (company_id in (select public.my_ops_companies(array[''company_admin'',''purchasing'']))) with check (company_id in (select public.my_ops_companies(array[''company_admin'',''purchasing''])))', t, t);
    execute format('create policy "%s_delete" on public.%I for delete using (company_id in (select public.my_ops_companies(array[''company_admin'',''purchasing''])))', t, t);
    execute format('create trigger %s_updated before update on public.%I for each row execute function public.set_updated_at()', t, t);
    execute format('create trigger %s_audit after insert or update or delete on public.%I for each row execute function public.audit_trigger()', t, t);
  end loop;
end $$;

alter table public.supply_freight_history enable row level security;
create policy freight_history_select on public.supply_freight_history for select
  using (company_id in (select public.my_ops_companies(array['company_admin','purchasing','weighbridge'])));
