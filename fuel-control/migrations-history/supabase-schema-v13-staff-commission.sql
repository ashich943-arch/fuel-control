-- ============================================================
-- Nexivo Fuel Control — v13: Staff Commission
-- Run this in Supabase SQL Editor → New Query.
--
-- Adds an optional per-liter commission rate to staff. Leave at 0
-- for staff who don't get commission (e.g. salaried-only). Reports
-- then shows each staff member's earned commission for the selected
-- period alongside their liters/sales.
-- ============================================================

alter table staff add column if not exists commission_per_liter numeric not null default 0;
