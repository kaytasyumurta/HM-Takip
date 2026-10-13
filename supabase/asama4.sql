-- Supabase > SQL Editor'e yapıştırıp RUN yapın. (AŞAMA 4: kantar kayıtları + otomatik tonaj)
-- Aşama 1, 2 ve 3 SQL'leri daha önce çalıştırılmış olmalı.

-- ============ 1) TEDARİK EMRİNE GERÇEKLEŞEN TONAJ (sadece kantar kayıtlarından hesaplanır) ============
alter table public.supply_orders add constraint supply_orders_id_company_uidx unique (id, company_id);
alter table public.supply_orders
  add column received_kg numeric(16,2) not null default 0,
  add column truck_count int not null default 0;

-- Gerçekleşen tonaj elle değiştirilemez (API ile bile)
create or replace function public.guard_received() returns trigger
language plpgsql as $$
begin
  if (new.received_kg is distinct from old.received_kg or new.truck_count is distinct from old.truck_count)
     and coalesce(current_setting('app.recompute', true), '') <> '1' then
    raise exception 'Gerçekleşen tonaj elle değiştirilemez; kantar kayıtlarından otomatik hesaplanır.';
  end if;
  return new;
end $$;
create trigger supply_orders_guard before update on public.supply_orders
for each row execute function public.guard_received();

create or replace function public.reset_received() returns trigger
language plpgsql as $$
begin new.received_kg := 0; new.truck_count := 0; return new; end $$;
create trigger supply_orders_reset before insert on public.supply_orders
for each row execute function public.reset_received();

-- ============ 2) ARAÇ KARTLARI (kayıtlı dara) ============
create or replace function public.norm_plate(p text) returns text
language sql immutable as $$ select upper(regexp_replace(coalesce(p, ''), '\s+', '', 'g')) $$;

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  plate text not null,
  last_tare_kg numeric(14,2),
  driver_name text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, plate)
);
create or replace function public.vehicles_norm() returns trigger
language plpgsql as $$ begin new.plate := public.norm_plate(new.plate); return new; end $$;
create trigger vehicles_norm_t before insert or update on public.vehicles
for each row execute function public.vehicles_norm();
create trigger vehicles_updated before update on public.vehicles
for each row execute function public.set_updated_at();

-- ============ 3) KANTAR KAYITLARI ============
create table public.weighbridge_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  ticket_no int not null,
  supply_order_id uuid not null,
  supplier_id uuid not null references public.suppliers(id),
  product_id uuid not null references public.products(id),
  plate text not null,
  driver_name text,
  weighed_at timestamptz not null default now(),          -- tartım zamanı
  gross_kg numeric(14,2) not null check (gross_kg > 0),
  tare_kg numeric(14,2) not null check (tare_kg >= 0),
  net_kg numeric(14,2) generated always as (gross_kg - tare_kg) stored,
  moisture_pct numeric(5,2) check (moisture_pct between 0 and 100),
  deduction_kg numeric(14,2) not null default 0 check (deduction_kg >= 0),
  freight_amount numeric(14,2) check (freight_amount >= 0),
  tare_alert boolean not null default false,
  status text not null default 'approved' check (status in ('pending','approved','cancelled')),
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),          -- kaydın oluşturulma zamanı
  updated_at timestamptz not null default now(),
  unique (company_id, ticket_no),
  foreign key (supply_order_id, company_id) references public.supply_orders (id, company_id),
  check (gross_kg > tare_kg)
);
create index weighbridge_company_time_idx on public.weighbridge_records (company_id, weighed_at desc);
create index weighbridge_order_idx on public.weighbridge_records (supply_order_id);

-- Tedarik toplamını kilit altında yeniden hesapla (aynı anda iki kayıt girilse bile tutarlı)
create or replace function public.recompute_supply_order(p_order uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o public.supply_orders%rowtype; v_kg numeric; v_cnt int; v_status text;
begin
  select * into o from public.supply_orders where id = p_order for update;
  if not found then return; end if;
  select coalesce(sum(net_kg), 0), count(*) into v_kg, v_cnt
    from public.weighbridge_records where supply_order_id = p_order and status = 'approved';
  v_status := o.status;
  if o.status in ('active', 'partial', 'completed') then
    v_status := case when v_kg >= o.planned_qty * 1000 then 'completed'
                     when v_kg > 0 then 'partial' else 'active' end;
  end if;
  perform set_config('app.recompute', '1', true);
  update public.supply_orders set received_kg = v_kg, truck_count = v_cnt, status = v_status where id = p_order;
  perform set_config('app.recompute', '', true);
end $$;

create or replace function public.wb_before() returns trigger
language plpgsql security definer set search_path = public as $$
declare o public.supply_orders%rowtype; v public.vehicles%rowtype; v_no int; chk boolean;
begin
  new.plate := public.norm_plate(new.plate);
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(hashtext('wb_records:' || new.company_id::text));
    select coalesce(max(ticket_no), 0) + 1 into v_no from public.weighbridge_records where company_id = new.company_id;
    new.ticket_no := v_no;
    chk := true;
  else
    new.ticket_no := old.ticket_no;
    new.updated_at := now();
    chk := new.supply_order_id is distinct from old.supply_order_id
        or (old.status = 'cancelled' and new.status <> 'cancelled')
        or (old.status <> 'approved' and new.status = 'approved');
  end if;

  select * into o from public.supply_orders where id = new.supply_order_id and company_id = new.company_id;
  if not found then raise exception 'Tedarik bulunamadı.'; end if;
  new.supplier_id := o.supplier_id;
  new.product_id := o.product_id;
  if chk and new.status <> 'cancelled' and o.status not in ('active', 'partial') then
    raise exception 'Bu tedarik "%" durumunda; kantar kaydı eklenemez. Önce tedariği yeniden açın.',
      case o.status when 'completed' then 'Tamamlandı' when 'draft' then 'Taslak' else 'İptal edildi' end;
  end if;

  -- dara değişim uyarısı: kayıtlı dara ile %5'ten fazla fark
  if tg_op = 'INSERT' or new.tare_kg is distinct from old.tare_kg or new.plate is distinct from old.plate then
    select * into v from public.vehicles where company_id = new.company_id and plate = new.plate;
    if found and v.last_tare_kg is not null and v.last_tare_kg > 0
       and abs(new.tare_kg - v.last_tare_kg) / v.last_tare_kg > 0.05 then
      new.tare_alert := true;
    else
      new.tare_alert := false;
    end if;
  end if;
  return new;
end $$;
create trigger wb_before_t before insert or update on public.weighbridge_records
for each row execute function public.wb_before();

create or replace function public.wb_after() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform public.recompute_supply_order(old.supply_order_id);
    return old;
  end if;
  perform public.recompute_supply_order(new.supply_order_id);
  if tg_op = 'UPDATE' and old.supply_order_id is distinct from new.supply_order_id then
    perform public.recompute_supply_order(old.supply_order_id);
  end if;
  if new.status <> 'cancelled' then
    insert into public.vehicles (company_id, plate, last_tare_kg, driver_name)
    values (new.company_id, new.plate, new.tare_kg, nullif(new.driver_name, ''))
    on conflict (company_id, plate) do update
      set last_tare_kg = excluded.last_tare_kg,
          driver_name = coalesce(excluded.driver_name, public.vehicles.driver_name),
          updated_at = now();
  end if;
  return new;
end $$;
create trigger wb_after_t after insert or update or delete on public.weighbridge_records
for each row execute function public.wb_after();

create trigger weighbridge_audit after insert or update or delete on public.weighbridge_records
for each row execute function public.audit_trigger();

-- ============ 4) ÖZET (ana sayfa kartları) ============
create or replace function public.weighbridge_summary(p_company uuid)
returns table (today_trucks bigint, today_kg numeric, month_kg numeric, pending bigint)
language sql stable as $$
  select
    count(*) filter (where status = 'approved' and (weighed_at at time zone 'Europe/Istanbul')::date = (now() at time zone 'Europe/Istanbul')::date),
    coalesce(sum(net_kg) filter (where status = 'approved' and (weighed_at at time zone 'Europe/Istanbul')::date = (now() at time zone 'Europe/Istanbul')::date), 0),
    coalesce(sum(net_kg) filter (where status = 'approved' and date_trunc('month', weighed_at at time zone 'Europe/Istanbul') = date_trunc('month', now() at time zone 'Europe/Istanbul')), 0),
    count(*) filter (where status = 'pending')
  from public.weighbridge_records where company_id = p_company
$$;

-- ============ 5) YETKİLER (RLS) ============
-- Kantar kaydı: görüntüleme ve ekleme tüm firma rolleri | düzeltme: yönetici/satın alma, kantar personeli sadece kendi BEKLEYEN kaydı | silme: yönetici/satın alma
alter table public.weighbridge_records enable row level security;
alter table public.vehicles enable row level security;

create policy wb_select on public.weighbridge_records for select
  using (company_id in (select public.my_ops_companies(array['company_admin','purchasing','weighbridge'])));
create policy wb_insert on public.weighbridge_records for insert
  with check (created_by = auth.uid()
              and company_id in (select public.my_ops_companies(array['company_admin','purchasing','weighbridge'])));
create policy wb_update on public.weighbridge_records for update
  using (company_id in (select public.my_ops_companies(array['company_admin','purchasing']))
         or (created_by = auth.uid() and status = 'pending'
             and company_id in (select public.my_ops_companies(array['weighbridge']))))
  with check (company_id in (select public.my_ops_companies(array['company_admin','purchasing','weighbridge'])));
create policy wb_delete on public.weighbridge_records for delete
  using (company_id in (select public.my_ops_companies(array['company_admin','purchasing'])));

create policy vehicles_select on public.vehicles for select
  using (company_id in (select public.my_ops_companies(array['company_admin','purchasing','weighbridge'])));
create policy vehicles_insert on public.vehicles for insert
  with check (company_id in (select public.my_ops_companies(array['company_admin','purchasing'])));
create policy vehicles_update on public.vehicles for update
  using (company_id in (select public.my_ops_companies(array['company_admin','purchasing'])))
  with check (company_id in (select public.my_ops_companies(array['company_admin','purchasing'])));
create policy vehicles_delete on public.vehicles for delete
  using (company_id in (select public.my_ops_companies(array['company_admin','purchasing'])));
