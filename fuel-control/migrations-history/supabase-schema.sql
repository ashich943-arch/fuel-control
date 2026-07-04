-- ============================================================
-- Nexivo Fuel Control — Phase 1 Database Schema
-- Run this in your Supabase project: SQL Editor → New Query
-- ============================================================

-- 1. Tanks: current stock per fuel type
create table if not exists tanks (
  id bigint generated always as identity primary key,
  name text not null,
  fuel_type text not null check (fuel_type in ('petrol', 'diesel', 'hioctane')),
  capacity_liters numeric not null,
  current_liters numeric not null default 0,
  created_at timestamptz default now()
);

-- 2. Sales: every pump transaction
create table if not exists sales (
  id bigint generated always as identity primary key,
  pump text not null,
  fuel_type text not null check (fuel_type in ('petrol', 'diesel', 'hioctane')),
  liters numeric not null check (liters > 0),
  amount numeric not null check (amount >= 0),
  payment_mode text not null check (payment_mode in ('cash', 'card', 'easypaisa', 'jazzcash')),
  sold_at timestamptz not null default now()
);

-- 3. Tank deliveries: fuel purchases / restocking log
create table if not exists tank_deliveries (
  id bigint generated always as identity primary key,
  tank_id bigint references tanks(id) on delete set null,
  liters numeric not null check (liters > 0),
  rate_per_liter numeric not null check (rate_per_liter >= 0),
  supplier text,
  delivered_at timestamptz not null default now()
);

-- 4. Fuel prices: current + historical selling price per liter
create table if not exists fuel_prices (
  id bigint generated always as identity primary key,
  fuel_type text not null check (fuel_type in ('petrol', 'diesel', 'hioctane')),
  price_per_liter numeric not null check (price_per_liter > 0),
  effective_date date not null default current_date
);

-- 5. Expenses: daily running costs (Phase 2 will build the UI for this)
create table if not exists expenses (
  id bigint generated always as identity primary key,
  category text not null,
  amount numeric not null check (amount >= 0),
  note text,
  spent_at date not null default current_date
);

-- ============================================================
-- Helper function: weekly liters throughput (used by Overview page)
-- ============================================================
create or replace function weekly_throughput()
returns table(day text, liters numeric) as $$
  select
    to_char(sold_at, 'Dy') as day,
    sum(liters) as liters
  from sales
  where sold_at >= now() - interval '7 days'
  group by 1, date_trunc('day', sold_at)
  order by date_trunc('day', sold_at);
$$ language sql stable;

-- ============================================================
-- Seed data — replace with your real station's tanks & prices
-- ============================================================
insert into tanks (name, fuel_type, capacity_liters, current_liters) values
  ('Petrol Tank', 'petrol', 10000, 7200),
  ('Diesel Tank', 'diesel', 10000, 4200),
  ('Hi-Octane Tank', 'hioctane', 3000, 2640)
on conflict do nothing;

insert into fuel_prices (fuel_type, price_per_liter, effective_date) values
  ('petrol', 272.90, current_date),
  ('diesel', 279.50, current_date),
  ('hioctane', 305.00, current_date)
on conflict do nothing;

-- ============================================================
-- Row Level Security — single-admin setup
-- Since this is a single-user dashboard, the simplest secure
-- approach is: enable RLS, allow all actions only to authenticated
-- users (i.e. your one admin login via Supabase Auth).
-- ============================================================
alter table tanks enable row level security;
alter table sales enable row level security;
alter table tank_deliveries enable row level security;
alter table fuel_prices enable row level security;
alter table expenses enable row level security;

create policy "Authenticated full access - tanks" on tanks
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access - sales" on sales
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access - deliveries" on tank_deliveries
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access - prices" on fuel_prices
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access - expenses" on expenses
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
