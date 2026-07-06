# Nexivo Fuel Control

A fuel station management dashboard — tank inventory, pump shift entries,
pricing, expenses, staff & payroll, Udhaar/credit customer ledgers, cash
reconciliation, and reports with CSV export. Built with React + Vite,
backed by Supabase (Postgres + Auth).

## Tech stack

- React 19 + Vite
- Tailwind CSS
- Supabase (database, auth, row-level security)

## Setting up a new station

1. Create a new Supabase project.
2. In SQL Editor, run `setup.sql` (project root) — this creates every
   table, security policy, and a few starter tanks/prices/pumps to edit.
3. Copy your project's URL and anon key (Supabase → Project Settings →
   API) into a `.env` file in this project:

   ```
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```

4. Create the owner/admin login: Supabase → Authentication → Add User
   (email + password). This is the only login needed — there's no
   separate staff-login system currently.
5. Update `src/lib/config.js` with the station's real name.
6. Install and run:

   ```
   npm install
   npm run dev
   ```

7. Sign in, then from the dashboard: set real tank capacities and
   opening stock (Tank Inventory), confirm pump → tank assignment,
   set real fuel prices (Pricing), and add staff (Staff).

## Existing installation

If you're working on an already-running station (not setting up a new
one), you don't need `setup.sql` — just `npm install` and `npm run dev`
as usual. See `migrations-history/README.md` if you need to know what
schema changes have been applied over time.

## Deployment

Deployed via Vercel, connected to GitHub. Push to the connected branch
and Vercel builds automatically. Set the same `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` values as environment variables in the Vercel
project settings (Vercel doesn't read your local `.env` file).

## Project structure

```
src/
  components/     shared UI (TopBar, Sidebar, Login, TankGauge, etc.)
  pages/          one file per sidebar tab
  lib/
    api.js        all Supabase queries/mutations
    supabaseClient.js
    date.js       local-timezone date helpers (see note below)
    print.js      shared receipt/statement print formatting
    config.js     station name — edit this per client
    exportCsv.js  CSV download helper for Reports
  data/mockData.js  fallback data shown if Supabase isn't configured
```

## A note on dates

Always use `localDateString()` from `src/lib/date.js` for "today's
date" anywhere in this app — never `new Date().toISOString().slice(0, 10)`.
That pattern gives the UTC date, which is wrong for Pakistan (UTC+5):
anything logged between 12:00 AM-~5:00 AM local time would get stamped
with yesterday's date.--
