-- Supabase > SQL Editor'e yapıştırıp RUN yapın. (AŞAMA 1: çok firmalı temel + süper yönetici)

-- ============ TABLOLAR ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  is_super_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null,
  contact_info text,
  status text not null default 'active' check (status in ('active','passive')),
  license_start timestamptz not null default now(),
  license_end timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index companies_code_uidx on public.companies (upper(code));

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('company_admin','weighbridge','purchasing')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, user_id)
);

create table public.audit_logs (
  id bigserial primary key,
  company_id uuid,
  user_id uuid,
  table_name text,
  action text,
  record_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

-- ============ YARDIMCI FONKSİYONLAR (RLS özyinelemesini önler) ============
create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_super_admin from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.my_company_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select company_id from public.memberships where user_id = auth.uid() and active
$$;

create or replace function public.is_company_admin(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships
                 where company_id = cid and user_id = auth.uid() and active and role = 'company_admin')
$$;

create or replace function public.shares_company_admin(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships m
                 where m.user_id = uid and public.is_company_admin(m.company_id))
$$;

-- Sonraki aşamalardaki operasyon tabloları bu fonksiyonu kullanacak:
-- kullanıcı firmanın aktif üyesi + firma aktif + lisans bitmemiş (süre sunucu saatiyle kontrol edilir)
create or replace function public.company_has_access(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m join public.companies c on c.id = m.company_id
    where m.company_id = cid and m.user_id = auth.uid() and m.active
      and c.status = 'active' and c.license_end > now())
$$;

-- ============ OTOMATİK PROFİL: İLK KAYIT = SÜPER YÖNETİCİ ============
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare first_user boolean;
begin
  select not exists (select 1 from public.profiles) into first_user;
  insert into public.profiles (id, email, full_name, is_super_admin)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name',''), first_user);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ============ GÜNCELLEME ZAMANI + İŞLEM KAYDI ============
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create trigger companies_updated before update on public.companies
for each row execute function public.set_updated_at();

create or replace function public.audit_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
declare j jsonb; cid uuid;
begin
  j := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  cid := case when tg_table_name = 'companies' then (j->>'id')::uuid else (j->>'company_id')::uuid end;
  insert into public.audit_logs (company_id, user_id, table_name, action, record_id, details)
  values (cid, auth.uid(), tg_table_name, tg_op, j->>'id', j);
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger companies_audit after insert or update or delete on public.companies
for each row execute function public.audit_trigger();
create trigger memberships_audit after insert or update or delete on public.memberships
for each row execute function public.audit_trigger();

-- ============ GİRİŞ EKRANI İÇİN FİRMA ARAMA (sadece id + ad döner) ============
create or replace function public.lookup_company(p_code text)
returns table (id uuid, name text)
language sql stable security definer set search_path = public as $$
  select c.id, c.name from public.companies c where upper(c.code) = upper(trim(p_code)) limit 1
$$;
grant execute on function public.lookup_company(text) to anon, authenticated;

-- ============ E-POSTA İLE ÜYE EKLEME ============
create or replace function public.add_member_by_email(p_company uuid, p_email text, p_role text)
returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not (public.is_super_admin() or public.is_company_admin(p_company)) then
    raise exception 'Bu işlem için yetkiniz yok.';
  end if;
  if p_role not in ('company_admin','weighbridge','purchasing') then
    raise exception 'Geçersiz rol.';
  end if;
  select id into uid from public.profiles where lower(email) = lower(trim(p_email));
  if uid is null then
    raise exception 'Bu e-posta ile kayıtlı kullanıcı bulunamadı. Kişi önce hesap oluşturmalı.';
  end if;
  insert into public.memberships (company_id, user_id, role, active)
  values (p_company, uid, p_role, true)
  on conflict (company_id, user_id) do update set role = excluded.role, active = true;
end $$;

-- ============ YETKİLER (RLS) ============
alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.memberships enable row level security;
alter table public.audit_logs enable row level security;

-- profiles: kendi kaydın, süper yönetici hepsini, firma yöneticisi kendi firmasının üyelerini görür. Değiştirme: sadece süper yönetici.
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.is_super_admin() or public.shares_company_admin(id));
create policy profiles_update on public.profiles for update
  using (public.is_super_admin());

-- companies: üyeler kendi firmasını görür, süper yönetici hepsini; yazma sadece süper yönetici
create policy companies_select on public.companies for select
  using (public.is_super_admin() or id in (select public.my_company_ids()));
create policy companies_insert on public.companies for insert with check (public.is_super_admin());
create policy companies_update on public.companies for update using (public.is_super_admin());
create policy companies_delete on public.companies for delete using (public.is_super_admin());

-- memberships
create policy memberships_select on public.memberships for select
  using (public.is_super_admin() or user_id = auth.uid() or public.is_company_admin(company_id));
create policy memberships_insert on public.memberships for insert
  with check (public.is_super_admin() or public.is_company_admin(company_id));
create policy memberships_update on public.memberships for update
  using (public.is_super_admin() or public.is_company_admin(company_id))
  with check (public.is_super_admin() or public.is_company_admin(company_id));
create policy memberships_delete on public.memberships for delete
  using (public.is_super_admin() or public.is_company_admin(company_id));

-- audit_logs: sadece okuma (yazma tetikleyiciden olur)
create policy audit_select on public.audit_logs for select
  using (public.is_super_admin() or (company_id is not null and public.is_company_admin(company_id)));
