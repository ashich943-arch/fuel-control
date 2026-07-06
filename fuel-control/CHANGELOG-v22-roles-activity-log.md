# Nexivo Fuel Control — Owner/Manager Roles + Activity Log

## ⚠️ Run this SQL first

`migrations-history/supabase-schema-v10-roles-and-activity-log.sql`

Then run the one-time step at the bottom of that file to assign your
existing login the "owner" role (replace the email):

```sql
insert into user_profiles (id, email, role, full_name)
select id, email, 'owner', 'REPLACE_WITH_YOUR_NAME'
from auth.users where email = 'REPLACE_WITH_YOUR_OWNER_EMAIL'
on conflict (id) do update set role = 'owner', full_name = 'REPLACE_WITH_YOUR_NAME';
```

**If you skip this step**, your login defaults to manager-level access
(no Pricing, Staff, or Activity Log pages) — the app shows a banner
reminding you if this hasn't been done.

## What's new

### Owner vs Manager login roles
- **Owner** (existing login): full access, same as before.
- **Manager** (new): can log/view shifts, record deliveries, manage
  Udhaar/credit, do cash reconciliation, log expenses, and view
  reports. **Cannot** delete a shift, change fuel prices, or add/edit/
  remove staff — those stay owner-only, enforced in the database
  (Postgres RLS), not just hidden in the menu. Even a direct API call
  from a manager login would be rejected.
- To add a manager: Supabase → Authentication → Add User (their email
  + a password), then run the same SQL snippet with their email,
  their own name, and `'manager'` instead of `'owner'`. Don't reuse
  the owner's name/email — the Activity Log uses this to show who
  actually did what.
- The current role shows as a small badge next to Sign Out.

### Activity Log (new page, owner-only)
Automatically records: shifts logged/deleted, price changes, staff
added/edited/deactivated/removed, expenses logged/deleted, deliveries
recorded/deleted, reconciliations saved, and Udhaar transactions
posted/deleted — who did it, when, and what changed. Written directly
by database triggers, so no login (including managers) can insert,
edit, or delete log entries themselves — it's a genuine audit trail,
not just an in-app feature that could be turned off.

### Staff — edit & deactivate (was missing before)
- **Edit** any staff member's details (name, phone, role, salary).
- **Deactivate** instead of delete — their history (past shifts,
  payments) stays intact, but they drop out of the Shift Entry and
  Payment dropdowns. Reactivate any time.
- Both are owner-only, same as adding staff.

## Verified
- `npm install && npm run build` → clean
- `npx oxlint` → 0 warnings, 0 errors

## Caught in a follow-up audit (before this was ever deployed)

1. **Stale role on account switch.** If someone signed out and a
   different login signed in right after on the same browser (e.g.
   owner → manager), the previous login's role/permissions could
   briefly — or permanently, if the new profile fetch failed — carry
   over, since the app didn't clear the old profile before loading
   the new one. Fixed: profile state now resets the moment the actual
   logged-in user changes.
2. **Unnecessary re-check on token refresh.** The fix above initially
   re-ran on every session object change, including Supabase's silent
   background token refresh (every ~50 min) — which would have
   flickered the sidebar (Pricing/Staff briefly disappearing) even
   though the same person stayed logged in. Fixed to only reset when
   the logged-in user's ID actually changes.
3. **Misleading name template in the "add a manager" SQL snippet.**
   The example showed `full_name` hardcoded to `'Owner'`. Copy-pasting
   it for a new manager without remembering to also change that word
   would silently label all of that manager's Activity Log entries as
   "Owner" — confusing for exactly the kind of accountability this
   feature exists for. Reworded with explicit placeholders for both
   fields in `supabase-schema-v10-*.sql`, `setup.sql`, and this file.
