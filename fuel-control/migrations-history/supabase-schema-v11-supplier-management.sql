-- ============================================================
-- Nexivo Fuel Control — v11: Supplier Management
-- Run this in Supabase SQL Editor → New Query.
--
-- What this adds:
-- 1. suppliers — structured supplier records (name, phone, address)
--    instead of a free-text field on each delivery, which meant a
--    typo created a whole new "supplier" in the old summary and there
--    was no way to track how much the station owes each one.
-- 2. tank_deliveries gets supplier_id (linking to the new table) and
--    amount_paid (how much was paid at the time of delivery — 0 means
--    fully on credit, equal to the delivery's cost means fully paid).
--    The old free-text `supplier` column is kept for old deliveries
--    and as a fallback label; new deliveries should use supplier_id.
-- 3. supplier_payments — records payments made to a supplier after
--    the fact (paying down what's owed), same idea as Udhaar/credit
--    payments but in the other direction (money the station owes,
--    not money it's owed).
-- 4. Balance owed to a supplier = sum(delivery cost - amount_paid for
--    their deliveries) - sum(payments made to them). The app computes
--    this from the raw rows; nothing here stores a running total.
-- ============================================================

create table if not exists suppliers (
  id bigint generated always as identity primary key,
  name text not null,
  phone text,
  address text,
  fuel_type text check (fuel_type in ('petrol', 'diesel', 'hioctane')),
  notes text,
  active boolean not null default true,
  created_at timestamptz default now()
);

alter table tank_deliveries add column if not exists supplier_id bigint references suppliers(id) on delete set null;
alter table tank_deliveries add column if not exists amount_paid numeric not null default 0;

create table if not exists supplier_payments (
  id bigint generated always as identity primary key,
  supplier_id bigint not null references suppliers(id) on delete cascade,
  amount numeric not null check (amount > 0),
  note text,
  paid_at date not null default current_date,
  created_at timestamptz default now()
);

alter table suppliers enable row level security;
alter table supplier_payments enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'suppliers' and policyname = 'Authenticated full access - suppliers') then
    create policy "Authenticated full access - suppliers" on suppliers
      for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where tablename = 'supplier_payments' and policyname = 'Authenticated full access - supplier_payments') then
    create policy "Authenticated full access - supplier_payments" on supplier_payments
      for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
  end if;
end $$;

-- Same activity-log pattern as every other table (see migration v10)
drop trigger if exists trg_log_suppliers on suppliers;
create trigger trg_log_suppliers after insert or update or delete on suppliers
  for each row execute function log_activity();

drop trigger if exists trg_log_supplier_payments on supplier_payments;
create trigger trg_log_supplier_payments after insert or delete on supplier_payments
  for each row execute function log_activity();
