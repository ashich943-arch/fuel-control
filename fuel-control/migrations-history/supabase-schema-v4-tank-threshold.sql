-- ============================================================
-- Nexivo Fuel Control — Phase 5: Custom Low-Stock Threshold
-- Run this in your Supabase project: SQL Editor → New Query
-- ============================================================

alter table tanks add column if not exists low_stock_threshold_pct numeric not null default 25;
