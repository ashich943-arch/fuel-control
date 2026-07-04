-- ============================================================
-- Nexivo Fuel Control — Full Setup (single file)
--
-- Use this for a BRAND NEW client/station's Supabase project.
-- Run it once, top to bottom, in SQL Editor → New Query.
--
-- If you already have an existing installation (e.g. Cheema Fuel
-- Station) that was built up from the individual supabase-schema-v*.sql
-- files over time, you do NOT need this file — you already have
-- everything it creates. This file exists purely to make onboarding
-- a NEW station fast: one file instead of nine.
-- ============================================================

-- ---------- Tanks ----------
create table if not exists tanks (
  id bigint generated always as identity primary key,
  name text not null,
  fuel_type text not null check (fuel_type in ('petrol', 'diesel', 'hioctane')),
  capacity_liters numeric not null,
  current_liters numeric not null default 0,
  low_stock_threshold_pct numeric not null default 25,
  created_at timestamptz default now()
);

-- ---------- Tank deliveries (restocking log) ----------
create table if not exists tank_deliveries (
  id bigint generated always as identity primary key,
  tank_id bigint references tanks(id) on delete set null,
  liters numeric not null check (liters > 0),
  rate_per_liter numeric not null check (rate_per_liter >= 0),
  supplier text,
  delivered_at timestamptz not null default now()
);

-- ---------- Fuel prices (current + historical selling price) ----------
create table if not exists fuel_prices (
  id bigint generated always as identity primary key,
  fuel_type text not null check (fuel_type in ('petrol', 'diesel', 'hioctane')),
  price_per_liter numeric not null check (price_per_liter > 0),
  effective_date date not null default current_date
);

-- ---------- Expenses ----------
create table if not exists expenses (
  id bigint generated always as identity primary key,
  category text not null,
  amount numeric not null check (amount >= 0),
  note text,
  spent_at date not null default current_date
);

-- ---------- Staff ----------
create table if not exists staff (
  id bigint generated always as identity primary key,
  name text not null,
  cnic text,
  phone text,
  role text not null default 'Attendant' check (role in ('Attendant', 'Cashier', 'Manager')),
  monthly_salary numeric not null default 0,
  active boolean not null default true,
  created_at timestamptz default now()
);

-- ---------- Pumps (each wired to exactly one tank) ----------
create table if not exists pumps (
  id bigint generated always as identity primary key,
  name text not null,
  tank_id bigint references tanks(id) on delete set null,
  created_at timestamptz default now()
);

-- ---------- Shifts (one row per pump, per shift, per staff member) ----------
create table if not exists shifts (
  id bigint generated always as identity primary key,
  staff_id bigint references staff(id) on delete set null,
  pump text not null,
  fuel_type text not null check (fuel_type in ('petrol', 'diesel', 'hioctane')),
  shift_type text not null check (shift_type in ('Morning', 'Evening', 'Night')),
  shift_date date not null default current_date,
  opening_reading numeric not null,
  closing_reading numeric not null,
  price_per_liter numeric not null,
  cash_amount numeric not null default 0,
  card_amount numeric not null default 0,
  easypaisa_amount numeric not null default 0,
  jazzcash_amount numeric not null default 0,
  credit_amount numeric not null default 0,
  created_at timestamptz default now(),
  constraint closing_after_opening check (closing_reading >= opening_reading)
  -- Note: no uniqueness constraint on (pump, shift_date, shift_type) —
  -- multiple staff can legitimately log separate readings within the
  -- same shift window (each attendant's opening reading auto-chains
  -- from the last one's closing reading), so that combination is not
  -- reliably unique in real usage.
);

-- ---------- Salary payments / advances / deductions ----------
create table if not exists salary_payments (
  id bigint generated always as identity primary key,
  staff_id bigint references staff(id) on delete cascade,
  amount numeric not null check (amount > 0),
  type text not null check (type in ('salary', 'advance', 'deduction')),
  note text,
  paid_at date not null default current_date
);

-- ---------- Credit / Udhaar customers ----------
create table if not exists credit_customers (
  id bigint generated always as identity primary key,
  name text not null,
  phone text,
  address text,
  credit_limit numeric default 0,
  active boolean not null default true,
  created_at timestamptz default now()
);

create table if not exists credit_transactions (
  id bigint generated always as identity primary key,
  customer_id bigint not null references credit_customers(id) on delete cascade,
  type text not null check (type in ('credit_sale', 'payment')),
  amount numeric not null check (amount > 0),
  fuel_type text check (fuel_type in ('petrol', 'diesel', 'hioctane')),
  liters numeric,
  note text,
  transaction_date date not null default current_date,
  created_at timestamptz default now(),
  -- links back to the shift that created this entry (if any), so
  -- deleting that shift can clean up its Udhaar entry too
  shift_id bigint references shifts(id) on delete set null
);

-- ---------- Daily cash reconciliation ----------
create table if not exists daily_reconciliations (
  id bigint generated always as identity primary key,
  reconciliation_date date not null unique,
  declared_cash numeric not null,
  actual_cash numeric not null,
  discrepancy numeric not null,
  note text,
  created_at timestamptz default now()
);

-- ============================================================
-- Helper function: weekly liters throughput (used by Overview page)
-- ============================================================
create or replace function weekly_throughput()
returns table(day text, liters numeric) as $$
  select
    to_char(shift_date, 'Dy') as day,
    sum(closing_reading - opening_reading) as liters
  from shifts
  where shift_date >= current_date - interval '7 days'
  group by 1, shift_date
  order by shift_date;
$$ language sql stable;

-- ============================================================
-- Atomic helper functions — tank stock changes, shift logging,
-- and shift deletion all happen inside the database in one
-- transaction so two people saving at once (or a dropped
-- connection mid-save) can never leave stock or Udhaar wrong.
-- ============================================================
create or replace function adjust_tank_level(p_tank_id bigint, p_delta numeric)
returns numeric as $$
declare
  v_new numeric;
  v_capacity numeric;
begin
  select capacity_liters into v_capacity from tanks where id = p_tank_id for update;
  if v_capacity is null then
    raise exception 'Tank % not found', p_tank_id;
  end if;
  update tanks
    set current_liters = greatest(0, least(v_capacity, current_liters + p_delta))
    where id = p_tank_id
    returning current_liters into v_new;
  return v_new;
end;
$$ language plpgsql;

create or replace function log_shift(
  p_staff_id bigint, p_pump text, p_fuel_type text, p_shift_type text, p_shift_date date,
  p_opening numeric, p_closing numeric, p_price numeric,
  p_cash numeric, p_card numeric, p_easypaisa numeric, p_jazzcash numeric, p_credit numeric,
  p_tank_id bigint, p_credit_customer_id bigint default null
) returns shifts as $$
declare
  v_shift shifts;
  v_liters numeric;
  v_amount numeric;
  v_credit_liters numeric;
begin
  v_liters := greatest(0, p_closing - p_opening);
  v_amount := v_liters * p_price;

  insert into shifts (
    staff_id, pump, fuel_type, shift_type, shift_date,
    opening_reading, closing_reading, price_per_liter,
    cash_amount, card_amount, easypaisa_amount, jazzcash_amount, credit_amount
  ) values (
    p_staff_id, p_pump, p_fuel_type, p_shift_type, p_shift_date,
    p_opening, p_closing, p_price, p_cash, p_card, p_easypaisa, p_jazzcash, p_credit
  )
  returning * into v_shift;

  perform adjust_tank_level(p_tank_id, -v_liters);

  if p_credit > 0 and p_credit_customer_id is not null then
    v_credit_liters := case when v_amount > 0 then round(v_liters * (p_credit / v_amount), 1) else 0 end;
    insert into credit_transactions (customer_id, type, amount, fuel_type, liters, note, transaction_date, shift_id)
    values (
      p_credit_customer_id, 'credit_sale', p_credit, p_fuel_type, v_credit_liters,
      p_pump || ' · ' || p_shift_type || ' shift · ' || p_shift_date::text,
      p_shift_date, v_shift.id
    );
  end if;

  return v_shift;
end;
$$ language plpgsql;

create or replace function delete_shift_and_revert(p_shift_id bigint, p_tank_id bigint)
returns void as $$
declare
  v_shift shifts;
begin
  select * into v_shift from shifts where id = p_shift_id for update;
  if v_shift is null then
    return;
  end if;
  perform adjust_tank_level(p_tank_id, (v_shift.closing_reading - v_shift.opening_reading));
  delete from credit_transactions where shift_id = p_shift_id;
  delete from shifts where id = p_shift_id;
end;
$$ language plpgsql;

-- ============================================================
-- Row Level Security — single-admin setup
-- Everything is locked to "authenticated users only" (your one
-- owner/manager login via Supabase Auth). No public access.
-- ============================================================
alter table tanks enable row level security;
alter table tank_deliveries enable row level security;
alter table fuel_prices enable row level security;
alter table expenses enable row level security;
alter table staff enable row level security;
alter table pumps enable row level security;
alter table shifts enable row level security;
alter table salary_payments enable row level security;
alter table credit_customers enable row level security;
alter table credit_transactions enable row level security;
alter table daily_reconciliations enable row level security;

create policy "Authenticated full access - tanks" on tanks
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access - deliveries" on tank_deliveries
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access - prices" on fuel_prices
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access - expenses" on expenses
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access - staff" on staff
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access - pumps" on pumps
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access - shifts" on shifts
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access - salary_payments" on salary_payments
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access - credit_customers" on credit_customers
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access - credit_transactions" on credit_transactions
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access - daily_reconciliations" on daily_reconciliations
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ============================================================
-- Starter data — EDIT these values before going live with a
-- new client. Tank capacities are a common 10,000L / 3,000L
-- default; change to match their real tanks. Prices are a
-- placeholder — set the real ones from the Pricing page after
-- setup instead of trusting these.
-- ============================================================
insert into tanks (name, fuel_type, capacity_liters, current_liters) values
  ('Petrol Tank', 'petrol', 10000, 0),
  ('Diesel Tank', 'diesel', 10000, 0),
  ('Hi-Octane Tank', 'hioctane', 3000, 0)
on conflict do nothing;

insert into fuel_prices (fuel_type, price_per_liter, effective_date) values
  ('petrol', 272.90, current_date),
  ('diesel', 279.50, current_date),
  ('hioctane', 305.00, current_date)
on conflict do nothing;

insert into pumps (name, tank_id)
select 'P-1', (select id from tanks where fuel_type = 'petrol' order by id limit 1)
where not exists (select 1 from pumps where name = 'P-1');

insert into pumps (name, tank_id)
select 'P-2', (select id from tanks where fuel_type = 'diesel' order by id limit 1)
where not exists (select 1 from pumps where name = 'P-2');

insert into pumps (name, tank_id)
select 'P-3', (select id from tanks where fuel_type = 'hioctane' order by id limit 1)
where not exists (select 1 from pumps where name = 'P-3');

-- ============================================================
-- Next steps after running this:
-- 1. Set the real tank capacities and starting stock (via
--    Tank Inventory → Edit capacity, then Record a Delivery for
--    the opening stock).
-- 2. Confirm pump → tank assignment matches this station's real
--    wiring (Tank Inventory → Pump Assignment).
-- 3. Set real fuel prices (Pricing page).
-- 4. Add staff (Staff page).
-- 5. Change the station name in src/lib/config.js before deploying.
-- ============================================================
