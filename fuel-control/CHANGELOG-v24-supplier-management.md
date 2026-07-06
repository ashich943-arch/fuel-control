# Nexivo Fuel Control — Supplier Management

## ⚠️ Run this SQL first

`migrations-history/supabase-schema-v11-supplier-management.sql`

No follow-up steps needed after running it (unlike v10, there's no
role-assignment step here).

## What's new

### Suppliers page (new sidebar tab, open to Owner + Manager)
- Add/edit suppliers with name, phone, address, and which fuel they
  supply (or "any").
- **Balance owed** to each supplier, calculated automatically from
  their deliveries minus what's been paid — no manual bookkeeping.
- Open a supplier's ledger to see every delivery and payment, record
  a new payment, or print a statement (same idea as the Udhaar/Credit
  customer statements).
- Deactivate a supplier once their balance is settled — their history
  stays intact, they just drop off the delivery dropdown.

### Tank Inventory — delivery form changed
- **Supplier is now a dropdown** instead of free text, so "PSO Depot"
  and "pso depot" don't become two different suppliers by accident.
  There's a "+ New" button to add one inline without leaving the form.
- **New "Amount Paid Now" field.** Leave it at 0 if the delivery is
  fully on credit (the whole cost shows up as owed to that supplier).
  Enter the full cost if you paid on the spot. Anything in between
  works too — it's a running balance, not all-or-nothing.
- Old deliveries recorded before this update keep their free-text
  supplier label and don't count toward any balance (no supplier link
  to attach them to) — this only applies going forward.

## Verified
- `npm install && npm run build` → clean
- `npx oxlint` → 0 warnings, 0 errors

## Caught in a self-audit (before this was ever deployed)

1. **UTC-date bug in the supplier ledger.** The ledger converted each
   delivery's timestamp to a date using `.slice(0, 10)` on the raw
   value — the same UTC-vs-local mistake this app specifically warns
   against everywhere else (see `src/lib/date.js`). A delivery
   recorded between 12:00 AM–~5:00 AM PKT would have shown up dated
   the day before in the supplier ledger. Fixed to use
   `localDateString()` like every other date in the app.
2. **Ledger hid the "paid at delivery" amount.** A delivery's ledger
   line originally showed only the net still-owed amount (cost minus
   what was paid on the spot), which made it look like nothing had
   been paid even when a large amount was handed over at delivery
   time. Fixed: each delivery now shows its full cost as one line,
   and any amount paid at delivery time shows as its own separate
   line right below it — same transparency as the Udhaar/Credit
   ledger. The total balance owed was always calculated correctly;
   this only fixes how it's broken down for the person reading it.
