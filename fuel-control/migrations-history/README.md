# SQL files — what to use when

## New station / new client → use `setup.sql` (in the project root)

Run that ONE file in Supabase SQL Editor and you're done — it creates
everything: tables, RLS policies, the weekly-throughput function, and
starter tanks/prices/pumps to edit.

## Existing installation (e.g. Cheema Fuel Station) → ignore this folder

If your database was already built up by running the `supabase-schema-v*.sql`
files one at a time as features were added, you already have everything —
don't run `setup.sql`, it would just no-op on tables that already exist
(the `create table if not exists` guards make it safe either way, but
there's no need).

## What's in this folder

These are kept only as a historical record of how the schema evolved,
in order:

1. `supabase-schema.sql` — tanks, sales (now unused/removed from the
   app), deliveries, prices, expenses
2. `supabase-schema-v2-staff-shifts.sql` — staff, shifts, salary payments
3. `supabase-schema-v3-credit.sql` — Udhaar/credit customers
4. `supabase-schema-v4-tank-threshold.sql` — per-tank low-stock %
5. `supabase-schema-v5-pumps.sql` — pumps table, multi-tank-per-fuel support
6. `supabase-schema-v6-reconciliation.sql` — old per-shift reconciliation
   (superseded by v8, safe to ignore)
7. `supabase-schema-v7-shift-credit-bucket.sql` — credit_amount on shifts
8. `supabase-schema-v8-daily-reconciliation.sql` — current reconciliation system
9. `supabase-schema-v9-atomic-integrity-fixes.sql` — atomic tank-stock
   functions (`adjust_tank_level`, `log_shift`, `delete_shift_and_revert`),
   duplicate-shift protection, and shift↔Udhaar linkage. **Required** —
   the app code calls these functions directly now instead of doing
   read-modify-write from the browser.
10. `supabase-schema-v10-roles-and-activity-log.sql` — adds Owner vs
    Manager login roles, a tamper-resistant activity log (who
    logged/deleted a shift, changed a price, added/removed staff,
    etc.), and restricts shift deletion, price changes, and staff
    management to the owner login only (enforced in the database, not
    just hidden in the UI). Includes a one-time step at the bottom to
    assign the existing owner login their role — required after
    running, or that login defaults to manager-level access.
11. `supabase-schema-v11-supplier-management.sql` — adds structured
    supplier records (`suppliers` table) and a purchase/payment ledger
    (`supplier_payments`, plus `supplier_id`/`amount_paid` columns on
    `tank_deliveries`) so the app can track how much the station owes
    each supplier, instead of a free-text field with no balance
    tracking.

`setup.sql` is the sum of all of these (minus the dead `sales` table and
the superseded v6 reconciliation columns), kept up to date going forward.
