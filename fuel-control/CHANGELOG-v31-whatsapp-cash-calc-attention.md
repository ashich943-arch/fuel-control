# Nexivo Fuel Control — WhatsApp Share, Cash Calculator, Needs Attention

No SQL migration for this one — pure frontend changes. Deploy the
code and you're done.

## What's new

### 1. Share Udhaar Statement on WhatsApp
Credit/Udhaar page → open a customer's ledger → **"Share on
WhatsApp"** button next to Print Statement. Opens WhatsApp (app or
web) with a ready-made message showing their name, station name, and
current balance — you just hit send. Uses WhatsApp's free `wa.me`
link scheme, no paid API or setup needed.

Handles common Pakistani phone formats automatically (0300-1234567,
03001234567, +923001234567 all work). If a customer has no phone
number on file, you'll get a clear message telling you to add one via
Edit rather than a confusing failure.

### 2. Cash Denomination Calculator (Reconciliation)
"Actual Cash Counted" now has a **"Count by notes instead"** link.
Toggling it shows a row for each note (Rs 5000 down to Rs 10) — enter
how many of each you counted, it totals them up, and "Use This Total"
fills the field for you. Less error-prone than adding it up by hand
or switching to a separate calculator app. Resets when you switch to
a different date, so old counts don't linger and confuse a new day's
count.

### 3. "Needs Attention" — one consolidated panel (Overview)
Replaces the old separate low-stock banner and reconciliation
reminder with a single panel that pulls together everything that
might need a look, each with a link straight to where to act on it:
- Low tank stock (same threshold as before)
- Yesterday's cash reconciliation not done yet
- **New:** any of the last 8 shifts where the payment split doesn't
  match the sale amount (the same check added a few versions ago,
  now surfaced here too so it's not easy to miss)
- **New:** suppliers currently owed money (top 3 by amount — there's
  no "days overdue" concept since deliveries don't have due dates, so
  this is just visibility, not urgency)

If nothing needs attention, the panel simply doesn't show — no empty
box taking up space on a normal day.

## Verified
- `npm install && npm run build` → clean
- `npx oxlint` → 0 warnings, 0 errors

## Caught in a self-audit (before this was ever deployed)

1. **The WhatsApp feature's own error message pointed to a feature
   that didn't exist.** If a customer had no phone number, the
   message said "Add one first (Edit customer)" — but Credit/Udhaar
   had no way to edit an existing customer at all, only add new ones
   or deactivate them. Fixed properly rather than just rewording the
   message: Credit customers can now be edited (name, phone, address,
   credit limit) the same way Staff and Suppliers already can.

2. **Three more gaps in Activity Log coverage**, found while checking
   the new WhatsApp fix didn't reference anything else missing:
   - Adding, editing, or removing a Udhaar customer was never logged.
   - Changing a tank's capacity or low-stock threshold was never
     logged (deliberately still NOT logging ordinary stock-level
     updates, which happen on every shift/delivery — that would flood
     the log with noise already visible via the shift/delivery record
     itself).
   - Adding a pump or reassigning it to a different tank was never
     logged, despite directly affecting which tank gets debited when
     a shift is logged on that pump.

   See `supabase-schema-v15-more-activity-log-coverage.sql`.

