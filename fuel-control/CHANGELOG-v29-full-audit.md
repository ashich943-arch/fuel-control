# Nexivo Fuel Control — Full App Audit (Post Commission/Reminder/Search/Profit Batch)

## ⚠️ Run this SQL again — even if you already ran v13 once

`migrations-history/supabase-schema-v13-staff-commission.sql` was
**updated** after you first ran it, to fix a real bug (see #3 below).
Re-running it is completely safe — every statement in it is written
to be safely re-run (`add column if not exists`, `create or replace
function`). Just run the whole file again in SQL Editor.

## What this audit found and fixed

### 1. Commission and Net Profit weren't in the Excel/Archive exports
Staff commission showed on-screen (Reports → Staff Performance) but
was missing from "Download Excel Report" and the Month-End Archive.
Fixed: both now include a full "Staff Performance" sheet with
Commission, matching the on-screen table.

### 2. Staff salary/advance/deduction payments never reduced Net Profit
**This is the most significant finding — please re-read your numbers
for any period where you've used Staff → Record Payment.**

Any payment recorded via Staff → Record Payment (salary, advance, or
deduction) was tracked nicely per staff member, but **never once
counted toward Total Expenses or Net Profit anywhere in the app** —
Overview, Reports, the Excel export, and the Month-End Archive all
ignored it completely. If you've paid staff through that feature,
your Net Profit has been overstated by that amount ever since.

Fixed: salary and advance payments now count as expenses (real cash
out), and deductions (money withheld from staff, e.g. a penalty)
subtract instead, since that's money the station keeps rather than
pays out. Every profit figure across the app now reflects this.

Both Overview and Reports show a small breakdown under "Expenses" —
e.g. "Rs X operating + Rs Y staff" — so it's clear what's included.

**A related note found while fixing this:** the Expenses page already
had a "Staff Salary" category, seemingly meant for the same purpose.
If you log a payment through *both* Expenses (as "Staff Salary") *and*
Staff → Record Payment for the same thing, it will now be double-
counted. Added a warning that appears right on the Expenses form when
"Staff Salary" is selected, reminding you to use Staff → Record
Payment instead for anything tied to a specific staff member.

### 3. Changing a staff member's commission rate would silently rewrite past shifts
Commission was being calculated live, by looking up each staff
member's *current* commission rate every time Reports ran — the same
mistake this app specifically avoids for fuel prices (which are
locked into each shift at the time it's logged, precisely so a later
price change doesn't rewrite history).

Example of the bug: set Bilal's commission to Rs 0.10/liter today,
log some shifts, then later raise it to Rs 0.20/liter — every past
shift's commission would silently jump to the new rate too, even
shifts logged back when the rate was still Rs 0.10.

Fixed: shifts now store the commission rate that was active *at the
time of the shift* (a new `commission_rate` column, filled in
automatically by the same database function that logs the shift).
Reports now reads this stored rate instead of the staff member's
live rate. Changing someone's commission rate going forward only
affects shifts logged after the change.

### 4. Pricing page had its own separate copy of fuel type labels/colors
Missed in an earlier cleanup pass that centralized this everywhere
else. Now uses the same shared `src/lib/fuelTypes.js` as every other
page — one file to update if fuel types ever change for a client.

## Verified
- `npm install && npm run build` → clean
- `npx oxlint` → 0 warnings, 0 errors
