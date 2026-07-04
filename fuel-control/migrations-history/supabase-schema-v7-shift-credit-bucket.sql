-- ============================================================
-- Nexivo Fuel Control — Phase 8: Credit bucket in Shift Payment Split
-- Run this in your Supabase project: SQL Editor → New Query
--
-- Audit finding: Shift Entry's payment split only had Cash/Card/
-- Easypaisa/JazzCash, with no way to mark part of a shift's fuel as
-- given on credit (Udhaar). Any shift with a credit sale in it always
-- showed a false "payment split doesn't match" warning, because the
-- 4 buckets could never add up to the full amount. This column fixes
-- that by giving Shift Entry a 5th bucket.
-- ============================================================

alter table shifts add column if not exists credit_amount numeric not null default 0;
