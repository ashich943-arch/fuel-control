-- ============================================================
-- ONE-TIME TEST DATA CLEANUP — run this yourself, once, in Supabase
-- SQL Editor when you're ready to wipe out testing/practice entries
-- and start clean for real business use.
--
-- This is NOT a schema migration (don't add it to migrations-history)
-- — it's a utility script you run manually, once, whenever you want.
--
-- What this clears: shifts, expenses, deliveries, credit customers &
-- transactions, salary payments, reconciliations — and resets every
-- tank's stock back to 0 (record fresh opening deliveries afterward
-- through the app).
--
-- What this KEEPS (structural/config data, not "test data" per se):
-- tanks, pumps, staff, suppliers, fuel prices, user roles. If you
-- want any of these cleared too, tell me and I'll adjust this script
-- — don't guess and delete them yourself, since staff/supplier rows
-- are referenced by other tables.
--
-- Activity Log is deliberately NOT cleared by default (see the
-- commented-out line near the bottom) — normally it should never be
-- cleared, since accountability is the whole point of it. Clearing it
-- now, before going live, is a reasonable one-time exception if you
-- want a clean log too — your call.
-- ============================================================

begin;

delete from credit_transactions;
delete from credit_customers;
delete from supplier_payments;
delete from tank_deliveries;
delete from shifts;
delete from expenses;
delete from salary_payments;
delete from daily_reconciliations;

-- Every tank back to empty — record fresh opening stock afterward
-- via Tank Inventory → Record Delivery.
update tanks set current_liters = 0;

-- Uncomment the line below if you also want a clean Activity Log:
-- delete from activity_log;

commit;
