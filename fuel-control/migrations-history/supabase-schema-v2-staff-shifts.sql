-- ============================================================
-- Nexivo Fuel Control — Phase 3 Migration
-- Staff, Shift Meter Readings, Salary Payments
-- Run this in Supabase SQL Editor AFTER the Phase 1 schema
-- ============================================================

-- 1. Staff members
create table if not exists staff (
  id bigint generated always as identity primary key,
  name text not null,
  cnic text,                        -- national ID, optional but recommended
  phone text,
  role text not null default 'Attendant' check (role in ('Attendant','Cashier','Manager')),
  monthly_salary numeric not null default 0,
  active boolean not null default true,
  created_at timestamptz default now()
);

-- 2. Shift meter readings — one row per pump, per shift, per staff member
create table if not exists shifts (
  id bigint generated always as identity primary key,
  staff_id bigint references staff(id) on delete set null,
  pump text not null,
  fuel_type text not null check (fuel_type in ('petrol','diesel','hioctane')),
  shift_type text not null check (shift_type in ('Morning','Evening','Night')),
  shift_date date not null default current_date,
  opening_reading numeric not null,
  closing_reading numeric not null,
  price_per_liter numeric not null,
  cash_amount numeric not null default 0,
  card_amount numeric not null default 0,
  easypaisa_amount numeric not null default 0,
  jazzcash_amount numeric not null default 0,
  created_at timestamptz default now(),
  constraint closing_after_opening check (closing_reading >= opening_reading)
);

-- 3. Salary payments / advances / deductions
create table if not exists salary_payments (
  id bigint generated always as identity primary key,
  staff_id bigint references staff(id) on delete cascade,
  amount numeric not null check (amount > 0),
  type text not null check (type in ('salary','advance','deduction')),
  note text,
  paid_at date not null default current_date
);

-- ============================================================
-- Weekly throughput now reads from shifts instead of the old
-- per-transaction sales table (replace the Phase 1 function)
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
-- RLS — same single-admin pattern as Phase 1
-- ============================================================
alter table staff enable row level security;
alter table shifts enable row level security;
alter table salary_payments enable row level security;

create policy "Authenticated full access - staff" on staff
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access - shifts" on shifts
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access - salary_payments" on salary_payments
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ============================================================
-- Seed a couple of staff so the Shift Entry dropdown isn't empty
-- Edit names/CNIC before using in production
-- ============================================================
insert into staff (name, cnic, phone, role, monthly_salary) values
  ('Attendant 1', '', '', 'Attendant', 25000),
  ('Attendant 2', '', '', 'Attendant', 25000)
on conflict do nothing;
