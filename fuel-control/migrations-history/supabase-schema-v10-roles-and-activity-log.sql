-- ============================================================
-- Nexivo Fuel Control — v10: Roles, permissions, activity log
-- Run this in Supabase SQL Editor → New Query.
--
-- What this adds:
-- 1. user_profiles — links each Supabase Auth login to a role
--    ('owner' or 'manager'). The owner already logging in today
--    needs a row here too (see step at the bottom of this file).
-- 2. activity_log — an automatic, tamper-resistant record of who
--    did what. Regular logins cannot insert, edit, or delete log
--    rows themselves (no policy grants that) — only the database
--    triggers below can write to it.
-- 3. Manager accounts can log shifts, record deliveries, manage
--    Udhaar/credit, do reconciliation, and view reports — but
--    CANNOT delete a shift, change fuel prices, or add/edit/remove
--    staff. Those stay owner-only, enforced at the database level
--    (not just hidden in the UI), so it holds even if someone calls
--    the API directly.
-- ============================================================

-- ---------- 1. User profiles (login → role) ----------
create table if not exists user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'manager' check (role in ('owner', 'manager')),
  created_at timestamptz default now()
);
alter table user_profiles enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'user_profiles' and policyname = 'Authenticated read access - user_profiles') then
    create policy "Authenticated read access - user_profiles" on user_profiles
      for select using (auth.role() = 'authenticated');
  end if;
end $$;

-- ---------- 2. is_owner() helper ----------
create or replace function is_owner()
returns boolean as $$
  select exists (
    select 1 from user_profiles where id = auth.uid() and role = 'owner'
  );
$$ language sql stable;

-- ---------- 3. Activity log ----------
create table if not exists activity_log (
  id bigint generated always as identity primary key,
  user_id uuid,
  actor_email text,
  actor_name text,
  actor_role text,
  table_name text not null,
  operation text not null,
  row_id bigint,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz default now()
);
alter table activity_log enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'activity_log' and policyname = 'Owner read access - activity_log') then
    create policy "Owner read access - activity_log" on activity_log
      for select using (is_owner());
  end if;
end $$;
-- Deliberately no insert/update/delete policy for any login — only
-- the trigger function below (running as its owner, which bypasses
-- RLS on its own table) can write here.

-- ---------- 4. Generic logging trigger ----------
create or replace function log_activity()
returns trigger as $$
declare
  v_email text;
  v_name text;
  v_role text;
begin
  select email into v_email from auth.users where id = auth.uid();
  select full_name, role into v_name, v_role from user_profiles where id = auth.uid();

  insert into activity_log (user_id, actor_email, actor_name, actor_role, table_name, operation, row_id, old_data, new_data)
  values (
    auth.uid(), v_email, v_name, v_role,
    TG_TABLE_NAME, TG_OP,
    (case when TG_OP = 'DELETE' then old.id else new.id end),
    (case when TG_OP in ('UPDATE', 'DELETE') then to_jsonb(old) else null end),
    (case when TG_OP in ('UPDATE', 'INSERT') then to_jsonb(new) else null end)
  );
  return coalesce(new, old);
end;
$$ language plpgsql security definer set search_path = public, auth;

drop trigger if exists trg_log_shifts on shifts;
create trigger trg_log_shifts after insert or delete on shifts
  for each row execute function log_activity();

drop trigger if exists trg_log_fuel_prices on fuel_prices;
create trigger trg_log_fuel_prices after insert on fuel_prices
  for each row execute function log_activity();

drop trigger if exists trg_log_staff on staff;
create trigger trg_log_staff after insert or update or delete on staff
  for each row execute function log_activity();

drop trigger if exists trg_log_expenses on expenses;
create trigger trg_log_expenses after insert or delete on expenses
  for each row execute function log_activity();

drop trigger if exists trg_log_deliveries on tank_deliveries;
create trigger trg_log_deliveries after insert or delete on tank_deliveries
  for each row execute function log_activity();

drop trigger if exists trg_log_reconciliations on daily_reconciliations;
create trigger trg_log_reconciliations after insert or update on daily_reconciliations
  for each row execute function log_activity();

drop trigger if exists trg_log_credit_transactions on credit_transactions;
create trigger trg_log_credit_transactions after insert or delete on credit_transactions
  for each row execute function log_activity();

-- ---------- 5. Tighten permissions: shifts ----------
drop policy if exists "Authenticated full access - shifts" on shifts;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'shifts' and policyname = 'Authenticated select - shifts') then
    create policy "Authenticated select - shifts" on shifts for select using (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where tablename = 'shifts' and policyname = 'Authenticated insert - shifts') then
    create policy "Authenticated insert - shifts" on shifts for insert with check (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where tablename = 'shifts' and policyname = 'Owner delete - shifts') then
    create policy "Owner delete - shifts" on shifts for delete using (is_owner());
  end if;
end $$;

-- ---------- 6. Tighten permissions: fuel_prices ----------
drop policy if exists "Authenticated full access - prices" on fuel_prices;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'fuel_prices' and policyname = 'Authenticated select - prices') then
    create policy "Authenticated select - prices" on fuel_prices for select using (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where tablename = 'fuel_prices' and policyname = 'Owner insert - prices') then
    create policy "Owner insert - prices" on fuel_prices for insert with check (is_owner());
  end if;
end $$;

-- ---------- 7. Tighten permissions: staff ----------
drop policy if exists "Authenticated full access - staff" on staff;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'staff' and policyname = 'Authenticated select - staff') then
    create policy "Authenticated select - staff" on staff for select using (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where tablename = 'staff' and policyname = 'Owner insert - staff') then
    create policy "Owner insert - staff" on staff for insert with check (is_owner());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'staff' and policyname = 'Owner update - staff') then
    create policy "Owner update - staff" on staff for update using (is_owner()) with check (is_owner());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'staff' and policyname = 'Owner delete - staff') then
    create policy "Owner delete - staff" on staff for delete using (is_owner());
  end if;
end $$;

-- ---------- 8. delete_shift_and_revert() — explicit owner check ----------
-- Postgres RLS silently skips rows a DELETE policy doesn't match
-- (no error) rather than raising one. Relying on that alone would
-- mean a manager's delete attempt looks like it "succeeded" (tank
-- stock reverted, Udhaar entry removed) while the shift row itself
-- silently stays — worse than before. This explicit check fails the
-- whole thing loudly and atomically instead.
create or replace function delete_shift_and_revert(p_shift_id bigint, p_tank_id bigint)
returns void as $$
declare
  v_shift shifts;
begin
  if not is_owner() then
    raise exception 'Only the station owner can delete a shift entry.' using errcode = '42501';
  end if;

  select * into v_shift from shifts where id = p_shift_id for update;
  if v_shift is null then
    return;
  end if;

  perform adjust_tank_level(p_tank_id, (v_shift.closing_reading - v_shift.opening_reading));

  delete from credit_transactions where shift_id = p_shift_id;
  delete from shifts where id = p_shift_id;
end;
$$ language plpgsql;

-- ============================================================
-- LAST STEP — run this yourself, once, for the owner account that
-- already exists (replace BOTH the email and the name):
--
--   insert into user_profiles (id, email, role, full_name)
--   select id, email, 'owner', 'REPLACE_WITH_OWNER_NAME'
--   from auth.users where email = 'REPLACE_WITH_OWNER_EMAIL'
--   on conflict (id) do update set role = 'owner', full_name = 'REPLACE_WITH_OWNER_NAME';
--
-- To add a manager later: create their login first (Authentication →
-- Add User), then run the same snippet with THEIR email, THEIR name,
-- and 'manager' instead of 'owner'. Don't skip the name — it's what
-- shows up next to their actions in the Activity Log, so leaving the
-- placeholder text (or a copy-pasted previous name) makes the log
-- misleading about who actually did what.
-- ============================================================
