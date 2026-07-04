-- ============================================================
-- Nexivo Fuel Control — Phase 10: Data-integrity fixes
-- Run this in your Supabase project: SQL Editor → New Query
--
-- Audit findings fixed by this migration:
--
-- 1. Tank stock (current_liters) was being read into the browser,
--    modified in JS, then written back. Two people saving around
--    the same time (or a slow connection + retry) could silently
--    overwrite each other's update and leave the tank total wrong
--    with no error shown. Fixed with an atomic `adjust_tank_level()`
--    function that does the add/subtract inside the database.
--
-- 2. Logging a shift did 3 separate network calls (insert shift,
--    update tank, insert credit transaction). If the connection
--    dropped between them, the shift could be saved but the tank
--    stock or the Udhaar entry would be missed. Fixed with a single
--    `log_shift()` function that does all of it in one transaction.
--
-- 3. Deleting a shift that had a credit/Udhaar amount reverted the
--    tank stock but left the credit_transactions row behind forever,
--    permanently inflating that customer's balance due. Fixed by
--    linking credit_transactions to the shift that created them and
--    cleaning them up together in `delete_shift_and_revert()`.
--
-- 4. (Withdrawn) An earlier draft of this migration added a unique
--    constraint to block a pump/date/shift_type from being logged
--    twice. Real Cheema data showed this was wrong: multiple staff
--    legitimately log separate entries within the same shift window
--    (each attendant's opening reading auto-chains from the last
--    one's closing reading) — that is normal usage, not a duplicate.
--    No such constraint is added.
--
-- Safe to run on the live Cheema database — every statement below
-- is additive and guarded, it does not touch or delete existing data.
-- ============================================================

-- ---------- 1. Link credit_transactions back to the shift that created them ----------
alter table credit_transactions add column if not exists shift_id bigint references shifts(id) on delete set null;

-- ---------- 2. (Removed) ----------
-- An earlier version of this migration added a unique constraint on
-- (pump, shift_date, shift_type) to block duplicate shift entries.
-- Live Cheema data showed this was wrong: multiple staff legitimately
-- log separate readings within the same "Morning"/"Evening"/"Night"
-- window (each attendant's opening reading auto-chains from the last
-- one's closing reading). That is normal usage, not a duplicate.
-- No constraint is added here — nothing to do in this step.

-- ---------- 3. Atomic tank level adjustment ----------
-- p_delta is positive for a delivery (adds stock) or negative for a
-- sale (removes stock). Result is clamped between 0 and capacity so
-- it can never go negative or overflow the tank.
create or replace function adjust_tank_level(p_tank_id bigint, p_delta numeric)
returns numeric as $$
declare
  v_new numeric;
  v_capacity numeric;
begin
  select capacity_liters into v_capacity from tanks where id = p_tank_id for update;
  if v_capacity is null then
    raise exception 'Tank % not found', p_tank_id;
  end if;

  update tanks
    set current_liters = greatest(0, least(v_capacity, current_liters + p_delta))
    where id = p_tank_id
    returning current_liters into v_new;

  return v_new;
end;
$$ language plpgsql;

-- ---------- 4. Atomic shift logging ----------
-- Inserts the shift, decrements the tank, and (if a credit amount +
-- customer are given) posts the Udhaar transaction — all in one
-- database transaction. If any part fails, none of it is saved.
create or replace function log_shift(
  p_staff_id bigint,
  p_pump text,
  p_fuel_type text,
  p_shift_type text,
  p_shift_date date,
  p_opening numeric,
  p_closing numeric,
  p_price numeric,
  p_cash numeric,
  p_card numeric,
  p_easypaisa numeric,
  p_jazzcash numeric,
  p_credit numeric,
  p_tank_id bigint,
  p_credit_customer_id bigint default null
) returns shifts as $$
declare
  v_shift shifts;
  v_liters numeric;
  v_amount numeric;
  v_credit_liters numeric;
begin
  v_liters := greatest(0, p_closing - p_opening);
  v_amount := v_liters * p_price;

  insert into shifts (
    staff_id, pump, fuel_type, shift_type, shift_date,
    opening_reading, closing_reading, price_per_liter,
    cash_amount, card_amount, easypaisa_amount, jazzcash_amount, credit_amount
  ) values (
    p_staff_id, p_pump, p_fuel_type, p_shift_type, p_shift_date,
    p_opening, p_closing, p_price,
    p_cash, p_card, p_easypaisa, p_jazzcash, p_credit
  )
  returning * into v_shift;

  perform adjust_tank_level(p_tank_id, -v_liters);

  if p_credit > 0 and p_credit_customer_id is not null then
    v_credit_liters := case when v_amount > 0 then round(v_liters * (p_credit / v_amount), 1) else 0 end;
    insert into credit_transactions (
      customer_id, type, amount, fuel_type, liters, note, transaction_date, shift_id
    ) values (
      p_credit_customer_id, 'credit_sale', p_credit, p_fuel_type, v_credit_liters,
      p_pump || ' · ' || p_shift_type || ' shift · ' || p_shift_date::text,
      p_shift_date, v_shift.id
    );
  end if;

  return v_shift;
end;
$$ language plpgsql;

-- ---------- 5. Atomic shift deletion + tank revert + orphan cleanup ----------
create or replace function delete_shift_and_revert(p_shift_id bigint, p_tank_id bigint)
returns void as $$
declare
  v_shift shifts;
begin
  select * into v_shift from shifts where id = p_shift_id for update;
  if v_shift is null then
    return;
  end if;

  perform adjust_tank_level(p_tank_id, (v_shift.closing_reading - v_shift.opening_reading));

  delete from credit_transactions where shift_id = p_shift_id;
  delete from shifts where id = p_shift_id;
end;
$$ language plpgsql;
