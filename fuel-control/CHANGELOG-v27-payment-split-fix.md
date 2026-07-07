# Nexivo Fuel Control — Critical Fix: Payment Split Wasn't Enforced

No SQL migration for this one — pure frontend fix. Deploy the code
and you're done.

## The bug you caught

A shift's sale amount (from meter readings × price) and its payment
split (Cash + Card + Easypaisa + JazzCash + Credit) could silently
not match. The app already calculated the mismatch and showed a
small warning text under the Payment Split fields — but **nothing
stopped the shift from saving anyway**. Rs 91,050 sold, only Rs
90,000 entered across the payment fields, and the missing Rs 1,050
just vanished with no trace of where it went — Overview and Reports
still showed the full Rs 91,050 as "sales," so the shortfall wasn't
visible anywhere unless someone happened to notice the small warning
text before submitting.

Also checked whether Reconciliation would have caught this separately
— it doesn't, because it only compares declared cash vs. physically
counted cash, not total sale vs. total payment split. A shortfall
recorded (or mis-recorded) this way wouldn't show up there either.

## What's fixed

1. **Shift Entry now blocks on mismatch.** If Cash+Card+Easypaisa+
   JazzCash+Credit doesn't add up to the sale amount, you get a clear
   confirmation popup showing exactly how much is missing (or extra)
   before it lets you save. You can still choose to continue if it's
   intentional (e.g. a genuine short payment you want on record), but
   you can no longer save it by accident without seeing the number.
2. **Reports now shows a period-level warning** if Total Sales doesn't
   match the combined payment split across the whole selected range —
   catches anything that slipped through before this fix, or any
   shift where "continue anyway" was used.
3. **Recent Shifts (Overview) flags the exact entry** with a ⚠ next to
   its amount if that specific shift's payment split doesn't add up —
   hover it to see how much and in which direction, so you know
   exactly which shift to go check.

## Full math audit (since you asked to check everything)

Went through every calculation in the app — Reconciliation,
Reports (margin, totals, staff performance), Credit/Udhaar balances,
Supplier balances, Tank days-left estimate, Overview stats. Only the
one bug above was found; everything else checked out arithmetically
correct. The three fixes above were the only changes made.

## Verified
- `npm install && npm run build` → clean
- `npx oxlint` → 0 warnings, 0 errors
