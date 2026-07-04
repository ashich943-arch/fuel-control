-- ============================================================
-- Nexivo Fuel Control — Phase 7: Shift Reconciliation
-- Run this in your Supabase project: SQL Editor → New Query
-- ============================================================

alter table shifts add column if not exists actual_cash_counted numeric;
alter table shifts add column if not exists discrepancy_amount numeric;
alter table shifts add column if not exists reconciled boolean not null default false;
