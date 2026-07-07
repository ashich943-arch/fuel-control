-- ============================================================
-- Nexivo Fuel Control — v14: Activity Log for Staff Payments
-- Run this in Supabase SQL Editor → New Query.
--
-- Fixes a gap found during testing: salary_payments (Staff → Record
-- Payment — salary, advance, deduction) was never wired into the
-- Activity Log, even though every other money-moving action was.
-- Given these payments now correctly reduce Net Profit (see v13),
-- they should be just as accountable/traceable as everything else.
-- ============================================================

drop trigger if exists trg_log_salary_payments on salary_payments;
create trigger trg_log_salary_payments after insert on salary_payments
  for each row execute function log_activity();
