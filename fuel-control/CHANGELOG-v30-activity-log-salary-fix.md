# Nexivo Fuel Control — Activity Log Gap (Staff Payments)

## ⚠️ Run this SQL

`migrations-history/supabase-schema-v14-log-salary-payments.sql`

## What was found (thanks to your testing!)

Staff → Record Payment (salary, advance, deduction) was never wired
into the Activity Log — every other money-moving action in the app
(shifts, expenses, deliveries, credit, supplier payments) had a
trigger recording who did it and when, but this one was missed.

Given these payments now correctly reduce Net Profit (see the
previous changelog), they deserve the same accountability as
everything else — this closes that gap.

## What's fixed
- Recording a salary/advance/deduction payment now shows up in the
  Activity Log, e.g. "recorded a salary payment of Rs 2,000 for
  Bilal" — including which staff member it was for, not just the
  amount.

## Verified
- `npm install && npm run build` → clean
- `npx oxlint` → 0 warnings, 0 errors
