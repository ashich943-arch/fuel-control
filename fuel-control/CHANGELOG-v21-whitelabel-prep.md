# Nexivo Fuel Control — Round 2 Fixes (White-Label Prep)

Follow-up to `CHANGELOG-v19-fixes.md`. No SQL migration needed for this
round — frontend-only changes. Just deploy the new code.

## Fixed

1. **Footer hardcoded "Cheema Fuel Station"** instead of reading
   `STATION_NAME` from `src/lib/config.js`. Would have silently kept
   showing "Cheema" on every future client's install unless someone
   remembered to hunt it down in `App.jsx`. Now reads from config
   like everywhere else.

2. **Fuel type labels/colors duplicated in 5 files** (Inventory,
   Credit, Shift Entry, Reports, Shifts Table) — each kept its own
   copy of `{ petrol: 'Petrol', diesel: 'Diesel', hioctane: 'Hi-Octane' }`
   plus its own color mapping. Risk: editing fuel types for a new
   client meant finding and updating all 5 (easy to miss one, causing
   inconsistent labels between pages). Centralized into
   `src/lib/fuelTypes.js` — one file, everywhere else imports from it.

3. **Reports → "Fuel Profit Margin" mixed time periods.** Sales
   figures were correctly scoped to the selected range (Today / This
   Week / This Month), but the purchase-cost side of the margin
   calculation always used the last 100 deliveries regardless of
   range. Selecting "Today" could show a margin computed against a
   delivery from weeks earlier. Added `getDeliveriesInRange()` and
   scoped it to match — margin numbers are now internally consistent
   with the sales numbers next to them. Also added a message when a
   period has no deliveries recorded, instead of just hiding the
   section silently.

4. **Color tokens named after the wrong color.** `tailwind.config.js`
   called the brand accent color `gold`, but the actual hex value is
   red (`#E5484D`). Harmless today, but confusing when rebranding for
   a new client with an actually-gold or blue or green brand — you'd
   be editing a variable called "gold" to make it blue. Renamed to
   `primary` / `primaryLight` / `primaryDim` across the whole codebase
   (17 files). See `WHITE-LABEL-GUIDE.md` for the 3-file rebrand
   checklist this enables.

## Added
- `WHITE-LABEL-GUIDE.md` — the checklist for spinning up a new client
  (branding files, fuel type customization, env vars, what NOT to
  touch).

## Verified
- `npm install && npm run build` → clean
- `npx oxlint` → 0 warnings, 0 errors
