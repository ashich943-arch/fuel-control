-- ============================================================
-- Nexivo Fuel Control — v13: Staff Commission
-- Run this in Supabase SQL Editor → New Query.
--
-- Adds an optional per-liter commission rate to staff. Leave at 0
-- for staff who don't get commission (e.g. salaried-only). Reports
-- then shows each staff member's earned commission for the selected
-- period alongside their liters/sales.
--
-- Also adds shifts.commission_rate, which stores the rate that was
-- in effect AT THE TIME of the shift — the same principle already
-- used for price_per_liter. Without this, raising or lowering a
-- staff member's commission later would retroactively recalculate
-- every past shift's commission using the new rate, which would be
-- wrong (and would even change numbers inside already-archived
-- Month-End reports if they were ever recomputed).
-- ============================================================

alter table staff add column if not exists commission_per_liter numeric not null default 0;
alter table shifts add column if not exists commission_rate numeric not null default 0;

-- Updated log_shift() to capture and store the commission rate at
-- the time of the shift (see migration v9/v10 for the rest of this
-- function's history).
create or replace function log_shift(
  p_staff_id bigint, p_pump text, p_fuel_type text, p_shift_type text, p_shift_date date,
  p_opening numeric, p_closing numeric, p_price numeric,
  p_cash numeric, p_card numeric, p_easypaisa numeric, p_jazzcash numeric, p_credit numeric,
  p_tank_id bigint, p_credit_customer_id bigint default null
) returns shifts as $$
declare
  v_shift shifts;
  v_liters numeric;
  v_amount numeric;
  v_credit_liters numeric;
  v_commission_rate numeric;
begin
  v_liters := greatest(0, p_closing - p_opening);
  v_amount := v_liters * p_price;

  select commission_per_liter into v_commission_rate from staff where id = p_staff_id;

  insert into shifts (
    staff_id, pump, fuel_type, shift_type, shift_date,
    opening_reading, closing_reading, price_per_liter,
    cash_amount, card_amount, easypaisa_amount, jazzcash_amount, credit_amount,
    commission_rate
  ) values (
    p_staff_id, p_pump, p_fuel_type, p_shift_type, p_shift_date,
    p_opening, p_closing, p_price, p_cash, p_card, p_easypaisa, p_jazzcash, p_credit,
    coalesce(v_commission_rate, 0)
  )
  returning * into v_shift;

  perform adjust_tank_level(p_tank_id, -v_liters);

  if p_credit > 0 and p_credit_customer_id is not null then
    v_credit_liters := case when v_amount > 0 then round(v_liters * (p_credit / v_amount), 1) else 0 end;
    insert into credit_transactions (customer_id, type, amount, fuel_type, liters, note, transaction_date, shift_id)
    values (
      p_credit_customer_id, 'credit_sale', p_credit, p_fuel_type, v_credit_liters,
      p_pump || ' · ' || p_shift_type || ' shift · ' || p_shift_date::text,
      p_shift_date, v_shift.id
    );
  end if;

  return v_shift;
end;
$$ language plpgsql;
