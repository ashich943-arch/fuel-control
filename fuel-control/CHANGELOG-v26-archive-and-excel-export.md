# Nexivo Fuel Control — Month-End Archive, Real Excel Export, Test-Data Cleanup

## ⚠️ Run this SQL first

`migrations-history/supabase-schema-v12-month-end-archive.sql`

No follow-up steps needed (unlike v10, no role-assignment step here).

## What's new

### 1. Test-Data Cleanup (one-time utility, not a migration)
`reset-test-data.sql` in the project root — run it yourself, once,
whenever you're ready to wipe out practice/testing entries and start
clean. Clears shifts, expenses, deliveries, credit ledger, salary
payments, and reconciliations, and resets every tank to 0 stock.
Keeps tanks/pumps/staff/suppliers/prices/roles as-is (those aren't
"test data" — they're your setup). Activity Log is left alone by
default (see the comment in the file for why, and how to also clear
it if you really want to).

**This is separate from the Month-End Archive below** — it's a
one-time reset for going from test data to real data, not something
you'd ever run again once the station is live.

### 2. Real Excel Export (Reports page)
The three separate CSV export buttons ("Export Summary" / "Export
Shifts" / "Export Expenses") are now one **"Download Excel Report"**
button that produces a single properly formatted `.xlsx` file with
three sheets (Summary, Shifts, Expenses) — bold colored headers,
frozen header row, correct number/currency formatting, sensible
column widths. CSVs looked "raw" when opened in Excel since they
carry zero formatting; this is a real spreadsheet.

Built with `exceljs` (not the more commonly seen `xlsx`/SheetJS
package — that one has known, unpatched security advisories). It's
loaded on demand only when you click the export button, so it doesn't
slow down the app for everyone who never uses this feature.

### 3. Month-End Archive (new section at the bottom of Reports, owner-only)
Lets you formally "close" a period (e.g. a month) with:
- A permanent record (`archived_periods` table) of that period's
  totals, who's viewing it and when it was closed
- An automatic Excel download of that period's full data at the same
  time

**Nothing is deleted.** Every shift, expense, and delivery from an
archived period stays exactly where it is and remains fully visible
in the Reports view above by picking that date range. Archiving is a
dated receipt confirming a period was reviewed and closed — not a
data wipe. This is deliberate: real business records (tax-relevant,
potentially disputed later) should never be irreversibly deleted just
to make the dashboard feel tidy.

A list of previously archived periods appears below the form, each
showing its locked-in Total Sales and Net Profit at the time it was
closed — useful for month-over-month comparison without re-running
reports.

## Verified
- `npm install && npm run build` → clean
- `npx oxlint` → 0 warnings, 0 errors
