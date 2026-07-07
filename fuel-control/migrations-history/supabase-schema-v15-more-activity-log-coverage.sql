-- ============================================================
-- Nexivo Fuel Control — v15: More Activity Log Coverage
-- Run this in Supabase SQL Editor → New Query.
--
-- Fixes gaps found while reviewing activity log coverage:
-- 1. credit_customers — adding/editing/removing a Udhaar customer
--    (including changing their credit limit) was never logged.
-- 2. tanks — adding a new tank, or changing a tank's CAPACITY or
--    LOW-STOCK THRESHOLD, was never logged. Deliberately does NOT
--    log every change to current_liters (stock level) — that column
--    is updated on every single shift and delivery via
--    adjust_tank_level(), and logging every one of those would flood
--    the log with noise that's already visible via the shift/
--    delivery record itself. Using "UPDATE OF capacity_liters,
--    low_stock_threshold_pct" means the update case only fires when
--    those specific columns are the ones being changed, not on
--    ordinary stock updates.
-- 3. pumps — adding a pump or reassigning it to a different tank
--    was never logged, even though this directly affects which
--    tank gets debited when a shift is logged on that pump.
-- ============================================================

drop trigger if exists trg_log_credit_customers on credit_customers;
create trigger trg_log_credit_customers after insert or update or delete on credit_customers
  for each row execute function log_activity();

drop trigger if exists trg_log_tanks on tanks;
create trigger trg_log_tanks after insert or update of capacity_liters, low_stock_threshold_pct on tanks
  for each row execute function log_activity();

drop trigger if exists trg_log_pumps on pumps;
create trigger trg_log_pumps after insert or update of tank_id on pumps
  for each row execute function log_activity();
