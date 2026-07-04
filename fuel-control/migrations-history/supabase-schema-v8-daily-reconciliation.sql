-- ============================================================
-- Nexivo Fuel Control — Phase 9: Simple Daily Reconciliation
-- Run this in your Supabase project: SQL Editor → New Query
--
-- Replaces the per-shift reconciliation (Phase 7) with a single
-- day-level cash check, which is simpler to use day to day. The
-- old actual_cash_counted / discrepancy_amount / reconciled columns
-- on `shifts` are no longer used by the app — harmless to leave in
-- place, but you can ignore them from now on.
-- ============================================================

create table if not exists daily_reconciliations (
  id bigint generated always as identity primary key,
  reconciliation_date date not null unique,
  declared_cash numeric not null,
  actual_cash numeric not null,
  discrepancy numeric not null,
  note text,
  created_at timestamptz default now()
);

alter table daily_reconciliations enable row level security;
create policy "Authenticated full access - daily_reconciliations" on daily_reconciliations
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
