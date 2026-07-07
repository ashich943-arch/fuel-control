# White-Labeling This for a New Client

Everything a new client needs is now centralized into a handful of
files. Clone the repo, work through this checklist top to bottom, and
you're done — no hunting through pages for hardcoded values.

## 1. Database (new Supabase project per client)
- Create a new Supabase project for the client
- Run `setup.sql` once (SQL Editor → New Query) — creates every table,
  RLS policy, the atomic stock functions, roles, and the activity log
- Authentication → Add User → create the owner's login (email + password)
- Run the owner-role assignment snippet at the bottom of `setup.sql`
  for that login (required — without it, the owner's own account
  defaults to manager-level access)

## 2. Branding — 3 files, that's it
| What | File | What to change |
|---|---|---|
| Station name | `src/lib/config.js` | `STATION_NAME` |
| Agency name (if reselling under a different brand) | `src/lib/config.js` | `AGENCY_NAME` |
| Brand accent color | `tailwind.config.js` | `primary`, `primaryLight`, `primaryDim` hex codes |
| Logo | `public/logo.png`, `logo-192.png`, `logo-512.png`, `favicon.svg` | replace with client's logo |
| App name (Install to Home Screen) | `public/manifest.json` | `name`, `short_name` |
| Browser tab title | `index.html` | `<title>` — optional, defaults to agency name |

That's the whole visual identity. No other file needs touching for a
standard rebrand.

## 3. Fuel types (only if this client differs from petrol/diesel/hi-octane)
- Frontend: edit `src/lib/fuelTypes.js` — one file, used everywhere
  (Shift Entry, Inventory, Credit, Reports, Shifts Table)
- Database: update the `fuel_type` check constraint on `tanks`,
  `fuel_prices`, `shifts`, `credit_transactions`, and `suppliers` in
  `setup.sql` to match (e.g. add `'cng'` to the list) before running it

## 4. Environment variables (Vercel → Settings → Environment Variables)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
(from the new client's Supabase project → Settings → API)

## 5. What you do NOT need to touch
- `src/lib/api.js`, atomic SQL functions, page logic — all generic,
  work for any station
- Tank count, pump count, staff count — all configured from inside the
  app after first login, not in code

## Known cosmetic debt (not blocking, fix opportunistically)
- Some Tailwind color tokens (`obsidian`, `ivory`, `panel`) are named
  after a darker theme this was likely adapted from, but hold light-UI
  values now. Harmless, just not self-descriptive — leave alone unless
  doing a full re-theme.
- `src/components/TankGauge.jsx` draws its gauge with raw SVG and a
  few hardcoded hex colors (matching `primary`/`primaryLight` at the
  time of writing) instead of referencing `tailwind.config.js` — SVG
  strokes can't use Tailwind classes directly, so this was simplest.
  If rebranding the accent color for a new client, update the hex
  values in this file too, or the gauge will keep the old color while
  the rest of the app updates.
