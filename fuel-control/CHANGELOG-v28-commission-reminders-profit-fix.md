# Nexivo Fuel Control — Commission, Reminders, Install, Search, True Profit

## ⚠️ Run this SQL first

`migrations-history/supabase-schema-v13-staff-commission.sql`

No follow-up steps needed after running it.

## What's new

### A. Staff Commission
Staff page now has an optional "Commission per liter (Rs)" field —
leave at 0 for staff who don't earn commission. Reports → Staff
Performance shows each person's earned commission for the selected
period, calculated from their actual liters sold.

### B. Reconciliation Reminder
Overview shows a banner if yesterday's cash reconciliation hasn't
been done yet — only when yesterday actually had shifts logged (no
nagging about a closed day). Links straight to the Reconciliation
page.

### C. Install to Home Screen
The app can now be installed like a native app (Android "Add to Home
Screen", desktop Chrome/Edge install icon in the address bar). This
is NOT full offline mode — every request still goes straight to the
network exactly as before. It's just the icon/shortcut convenience;
no offline data, no caching, no risk of showing stale prices or stock
levels. If real offline support is ever built, it uses the same
service worker file (`public/service-worker.js`), which is currently
a deliberate no-op.

### D. Reports — Search by Staff or Pump
New search box on the Reports page. Type a staff name or pump (e.g.
"Bilal" or "P-3") to see every matching shift in the selected date
range, with full details (date, shift, fuel, liters, amount).

### E. True Net Profit (fuel cost now included) — IMPORTANT
**"Net Profit" will look very different after this update — this is
a correction, not a bug.**

Previously, Net Profit = Total Sales − Operating Expenses. It never
subtracted the cost of the fuel itself (what you paid your supplier)
— the single biggest cost of running the station. That made the
number look far more profitable than it really was.

Now: **Net Profit = Total Sales − Fuel Cost − Operating Expenses**,
where Fuel Cost uses the weighted-average purchase price per liter
across every delivery ever recorded for that fuel type (not just
deliveries within the selected date range — fuel sold today may have
been bought weeks ago, so using only "today's deliveries" would wrongly
show no fuel cost on days without a delivery).

Both Overview ("Net Profit (Today)") and Reports ("Net Profit" for
the selected range) show a small breakdown line underneath so it's
clear how the number was built — e.g. "Sales − Fuel Cost (Rs X) −
Expenses". If no delivery has ever been recorded for a fuel type
that's being sold, the breakdown line turns into a clear ⚠ warning
instead of silently showing an inflated number — record a delivery
for that fuel type to get an accurate figure.

The Month-End Archive feature also uses this corrected formula, and
warns you before permanently archiving a period where fuel cost data
is incomplete for any fuel type sold in it (you can still proceed,
but you'll see it coming rather than finding out later).

The separate "Fuel Profit Margin" table further down Reports is
different on purpose — it only uses deliveries within the exact
selected date range, to show what you actually paid for fuel bought
in that specific window. Net Profit and that table can reasonably
show different-looking cost bases; that's expected, not a
contradiction.

## Verified
- `npm install && npm run build` → clean
- `npx oxlint` → 0 warnings, 0 errors

## Caught in a follow-up self-review (before this was ever deployed)
The first version of the True Net Profit fix silently treated missing
delivery-cost data as Rs 0 — meaning a brand-new fuel type with no
recorded delivery would still show a normal-looking (but inflated)
profit number, with only a small gray caption hinting something was
off. Fixed: the caption now turns into a bold ⚠ warning in the same
warning color used elsewhere in the app, and the Month-End Archive
form explicitly confirms with you before permanently saving a period
where this applies.
