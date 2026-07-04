-- ============================================================
-- Nexivo Fuel Control — Phase 4: Credit / Udhaar Customers
-- Run this in your Supabase project: SQL Editor → New Query
-- (Run AFTER schema.sql and schema-v2-staff-shifts.sql)
-- ============================================================

-- 1. Credit customers
create table if not exists credit_customers (
  id bigint generated always as identity primary key,
  name text not null,
  phone text,
  address text,
  credit_limit numeric default 0,
  active boolean not null default true,
  created_at timestamptz default now()
);

-- 2. Credit transactions: credit sales (debit) and payments received (credit)
create table if not exists credit_transactions (
  id bigint generated always as identity primary key,
  customer_id bigint not null references credit_customers(id) on delete cascade,
  type text not null check (type in ('credit_sale', 'payment')),
  amount numeric not null check (amount > 0),
  fuel_type text check (fuel_type in ('petrol', 'diesel', 'hioctane')),
  liters numeric,
  note text,
  transaction_date date not null default current_date,
  created_at timestamptz default now()
);

alter table credit_customers enable row level security;
alter table credit_transactions enable row level security;

create policy "Authenticated full access - credit_customers" on credit_customers
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated full access - credit_transactions" on credit_transactions
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
