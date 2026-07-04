# Nexivo Fuel Control — v19 Fixes (Audit → Fixed)

This build fixes every issue found in the full-codebase audit. Read
this before deploying.

## ⚠️ STEP 1 — Run this SQL first, before deploying the new code

Open Supabase → SQL Editor → New Query, and run:

```
migrations-history/supabase-schema-v9-atomic-integrity-fixes.sql
```

This adds the database functions the new code calls
(`adjust_tank_level`, `log_shift`, `delete_shift_and_revert`), links
Udhaar entries to the shift that created them, and adds a safety
constraint that blocks duplicate shift entries. **The app will throw
errors on Shift Entry / Inventory / Overview until this is run.**

If v7 and v8 (`supabase-schema-v7-shift-credit-bucket.sql`,
`supabase-schema-v8-daily-reconciliation.sql`) were not applied yet
either, run those first, then v9.

## STEP 2 — Deploy the code as usual

`npm install`, then push to your connected Vercel branch (or `npm run
build` + `npm run preview` to check locally first).

---

## What was fixed

### 🔴 Critical
- **Pending migrations (v7, v8)** — flagged as required; v9 (this
  release) adds the remaining piece.

### 🟠 Data integrity (the important fixes)
1. **Tank stock race condition** — every place that changed
   `current_liters` (logging a shift, recording a delivery, deleting
   either) used to read the value into the browser, do the math in
   JS, then write it back. Two people saving around the same time
   could silently overwrite each other's change. Fixed: tank stock is
   now changed atomically inside the database via
   `adjust_tank_level()` — the add/subtract happens in one SQL
   statement, so it can never be lost.
2. **Shift save was 3 separate network calls** (insert shift → update
   tank → insert Udhaar entry). A dropped connection between them
   could leave the shift saved but the tank or Udhaar entry missing.
   Fixed: `log_shift()` does all three in a single database
   transaction — either everything saves, or nothing does.
3. **Deleting a shift left orphaned Udhaar entries** — if a deleted
   shift had a credit amount, the customer's ledger entry stayed
   behind forever, inflating their balance. Fixed:
   `credit_transactions` now links back to the shift that created it
   (`shift_id`), and `delete_shift_and_revert()` cleans both up
   together.
4. **~~No protection against duplicate shift entries~~ (withdrawn)** —
   an earlier draft added a database constraint to block the same
   pump/date/shift_type from being logged twice. Testing against real
   Cheema data showed this breaks normal usage: multiple staff
   legitimately log separate entries within the same shift window
   (each attendant's opening reading auto-chains from the last one's
   closing reading), so that combination isn't reliably unique. No
   such constraint is added — this one was reverted.

### 🟡 Medium
5. **Credit limit was never checked** — Shift Entry and the Credit
   page now warn (and ask you to confirm) if a new credit sale would
   push a customer over their set credit limit. It doesn't hard-block
   in case you want to allow it for a trusted customer, but you'll
   always see the warning first.
6. **Errors were silently swallowed everywhere** — every `catch` block
   across all pages now logs the real error to the browser console
   (`F12` → Console tab) in addition to the friendly on-screen
   message, so if something ever fails at the station, you or I can
   actually see why.
7. **"Net Profit" hid real loss days** — it was floored at 0, so a day
   where expenses exceeded sales just showed "Rs 0" instead of the
   real negative number. Now shows the real number (in orange) on
   loss days.
8. **Reconciliation page had no error handling at all** — a failed
   save did nothing with zero feedback. Now shows a success/error
   message like every other page.

### 🟢 Polish
9. **Lint config was scanning `node_modules`** (2,500+ files, ~17,000
   false warnings) — added `ignorePatterns` so `npm run lint` only
   checks your actual code. Result: 0 warnings, 0 errors.
10. Removed a genuinely unused variable and wired up a previously
    dead `suffix` prop on the stat cards.

## Verified before handing this back
- `npm install && npm run build` → clean, no errors
- `npx oxlint` → 0 warnings, 0 errors (was 17,000+ before, all noise
  from node_modules being scanned)
