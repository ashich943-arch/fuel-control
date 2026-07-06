import { supabase, isSupabaseConfigured } from './supabaseClient';
import { localDateString } from './date';
import {
  mockTanks,
  mockPrices,
  mockExpensesToday,
  mockWeekly,
  mockExpenseList,
  mockStaff,
  mockShifts,
  mockSalaryPayments,
} from '../data/mockData';

// All functions gracefully fall back to mock data when Supabase
// isn't configured yet, so the UI is usable immediately after clone.

// ---------- Tanks ----------
export async function getTanks() {
  if (!isSupabaseConfigured) return mockTanks;
  const { data, error } = await supabase.from('tanks').select('*').order('id');
  if (error) throw error;
  return data;
}

// Atomic stock adjustment — the +/- happens inside the database via
// adjust_tank_level() (see migrations-history/supabase-schema-v9-*.sql),
// so two saves happening at the same time can never overwrite each
// other. p_delta is positive for a delivery, negative for a sale.
// Returns the new current_liters value.
export async function adjustTankLevel(tankId, delta) {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.rpc('adjust_tank_level', {
    p_tank_id: tankId,
    p_delta: delta,
  });
  if (error) {
    console.error('adjustTankLevel failed:', error);
    throw error;
  }
  return data;
}

export async function updateTankCapacity(tankId, capacity) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('tanks').update({ capacity_liters: capacity }).eq('id', tankId);
  if (error) throw error;
}

export async function updateTankThreshold(tankId, thresholdPct) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('tanks').update({ low_stock_threshold_pct: thresholdPct }).eq('id', tankId);
  if (error) throw error;
}

export async function addTank(tank) {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured — tank not persisted:', tank);
    return { ...tank, id: Date.now() };
  }
  const { data, error } = await supabase.from('tanks').insert([tank]).select().single();
  if (error) throw error;
  return data;
}

// ---------- Pumps ----------
export async function getPumps() {
  if (!isSupabaseConfigured) {
    return [
      { id: 1, name: 'P-1', tank_id: 1 },
      { id: 2, name: 'P-2', tank_id: 2 },
      { id: 3, name: 'P-3', tank_id: 3 },
    ];
  }
  const { data, error } = await supabase.from('pumps').select('*, tanks(name, fuel_type)').order('name');
  if (error) throw error;
  return data;
}

export async function addPump(pump) {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured — pump not persisted:', pump);
    return { ...pump, id: Date.now() };
  }
  const { data, error } = await supabase.from('pumps').insert([pump]).select().single();
  if (error) throw error;
  return data;
}

export async function updatePumpTank(pumpId, tankId) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('pumps').update({ tank_id: tankId }).eq('id', pumpId);
  if (error) throw error;
}

export async function addDelivery(delivery) {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured — delivery not persisted:', delivery);
    return { ...delivery, id: Date.now() };
  }
  const { data, error } = await supabase.from('tank_deliveries').insert([delivery]).select().single();
  if (error) throw error;
  return data;
}

export async function getDeliveries(limit = 100) {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('tank_deliveries')
    .select('*, tanks(fuel_type, name), suppliers(id, name)')
    .order('delivered_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

// Used by Reports so the "Fuel Profit Margin" purchase-cost average is
// scoped to the same date range as the sales figures next to it —
// getDeliveries() above always returns the most recent 100 regardless
// of range, which previously made margin numbers mix periods.
export async function getDeliveriesInRange(startDate, endDate) {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('tank_deliveries')
    .select('*, tanks(fuel_type, name), suppliers(id, name)')
    .gte('delivered_at', `${startDate}T00:00:00`)
    .lte('delivered_at', `${endDate}T23:59:59`)
    .order('delivered_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function deleteDelivery(id) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('tank_deliveries').delete().eq('id', id);
  if (error) throw error;
}

// ---------- Prices ----------
export async function getPrices() {
  if (!isSupabaseConfigured) return mockPrices;
  const { data, error } = await supabase
    .from('fuel_prices')
    .select('*')
    .order('effective_date', { ascending: false })
    .order('id', { ascending: false });
  if (error) throw error;
  const latest = {};
  for (const row of data) {
    if (!latest[row.fuel_type]) latest[row.fuel_type] = row;
  }
  return Object.values(latest);
}

export async function getPriceHistory(limit = 20) {
  if (!isSupabaseConfigured) return mockPrices.map((p) => ({ ...p, id: p.fuel_type }));
  const { data, error } = await supabase
    .from('fuel_prices')
    .select('*')
    .order('effective_date', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function setPrice(fuel_type, price_per_liter) {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured — price not persisted');
    return;
  }
  const { error } = await supabase.from('fuel_prices').insert([
    { fuel_type, price_per_liter, effective_date: localDateString() },
  ]);
  if (error) throw error;
}

// ---------- Expenses ----------
export async function getExpensesToday() {
  if (!isSupabaseConfigured) return mockExpenseList;
  const today = localDateString();
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('spent_at', today)
    .order('id', { ascending: false });
  if (error) throw error;
  return data;
}

export async function addExpense(expense) {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured — expense not persisted:', expense);
    return { ...expense, id: Date.now() };
  }
  const { data, error } = await supabase.from('expenses').insert([expense]).select().single();
  if (error) throw error;
  return data;
}

export async function deleteExpense(id) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) throw error;
}

// ---------- Dashboard aggregates ----------
export async function getTodayTotals() {
  if (!isSupabaseConfigured) {
    const totalSales = mockShifts.reduce((s, t) => s + t.amount, 0);
    const litersToday = mockShifts.reduce((s, t) => s + t.liters, 0);
    return { totalSales, litersToday, expenses: mockExpensesToday };
  }
  const today = localDateString();

  const [shiftsRes, expensesRes] = await Promise.all([
    supabase
      .from('shifts')
      .select('opening_reading, closing_reading, price_per_liter')
      .eq('shift_date', today),
    supabase.from('expenses').select('amount').eq('spent_at', today),
  ]);
  if (shiftsRes.error) throw shiftsRes.error;
  if (expensesRes.error) throw expensesRes.error;

  const litersToday = shiftsRes.data.reduce(
    (s, r) => s + (Number(r.closing_reading) - Number(r.opening_reading)),
    0
  );
  const totalSales = shiftsRes.data.reduce(
    (s, r) => s + (Number(r.closing_reading) - Number(r.opening_reading)) * Number(r.price_per_liter),
    0
  );
  const expenses = expensesRes.data.reduce((s, r) => s + Number(r.amount), 0);

  return { totalSales, litersToday, expenses };
}

export async function getWeeklyThroughput() {
  if (!isSupabaseConfigured) return mockWeekly;
  const { data, error } = await supabase.rpc('weekly_throughput');
  if (error) throw error;
  if (!data || data.length === 0) return [];
  return data.map((d) => ({ day: d.day?.trim(), liters: Number(d.liters) }));
}

// ---------- Staff ----------
export async function getStaff() {
  if (!isSupabaseConfigured) return mockStaff;
  const { data, error } = await supabase.from('staff').select('*').eq('active', true).order('name');
  if (error) throw error;
  return data;
}

// Used by the Staff management page (shows inactive staff too, so
// the owner can see/reactivate them). Shift Entry's dropdown should
// keep using getStaff() above — only active staff should show there.
export async function getAllStaff() {
  if (!isSupabaseConfigured) return mockStaff;
  const { data, error } = await supabase.from('staff').select('*').order('active', { ascending: false }).order('name');
  if (error) throw error;
  return data;
}

export async function addStaff(staff) {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured — staff not persisted:', staff);
    return { ...staff, id: Date.now() };
  }
  const { data, error } = await supabase.from('staff').insert([staff]).select().single();
  if (error) throw error;
  return data;
}

// ---------- Shifts (meter readings) ----------
export async function getRecentShifts(limit = 8) {
  if (!isSupabaseConfigured) return mockShifts;
  const { data, error } = await supabase
    .from('shifts')
    .select('*, staff(name)')
    .order('shift_date', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

// Atomic: inserts the shift, decrements the tank, and (if a credit
// amount + customer are given) posts the Udhaar transaction — all in
// one database transaction via log_shift() (see migration v9). If
// any part fails, none of it is saved.
export async function logShift({ shift, tankId, creditCustomerId }) {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured — shift not persisted:', shift);
    return { ...shift, id: Date.now() };
  }
  const { data, error } = await supabase.rpc('log_shift', {
    p_staff_id: shift.staff_id,
    p_pump: shift.pump,
    p_fuel_type: shift.fuel_type,
    p_shift_type: shift.shift_type,
    p_shift_date: shift.shift_date,
    p_opening: shift.opening_reading,
    p_closing: shift.closing_reading,
    p_price: shift.price_per_liter,
    p_cash: shift.cash_amount,
    p_card: shift.card_amount,
    p_easypaisa: shift.easypaisa_amount,
    p_jazzcash: shift.jazzcash_amount,
    p_credit: shift.credit_amount,
    p_tank_id: tankId,
    p_credit_customer_id: creditCustomerId || null,
  });
  if (error) {
    console.error('logShift failed:', error);
    throw error;
  }
  return data;
}

// Atomic: reverts the tank stock and removes any Udhaar entry that
// this shift created, then deletes the shift — all in one
// transaction via delete_shift_and_revert() (see migration v9).
export async function deleteShift(id, tankId) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.rpc('delete_shift_and_revert', {
    p_shift_id: id,
    p_tank_id: tankId,
  });
  if (error) {
    console.error('deleteShift failed:', error);
    throw error;
  }
}

export async function getLastClosingReading(pump, fuel_type) {
  if (!isSupabaseConfigured) return 0;
  const { data, error } = await supabase
    .from('shifts')
    .select('closing_reading')
    .eq('pump', pump)
    .eq('fuel_type', fuel_type)
    .order('shift_date', { ascending: false })
    .order('id', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0]?.closing_reading || 0;
}

// ---------- Daily reconciliation (simple, one entry per day) ----------
export async function getDeclaredCashForDate(date) {
  if (!isSupabaseConfigured) return 0;
  const { data, error } = await supabase.from('shifts').select('cash_amount').eq('shift_date', date);
  if (error) throw error;
  return data.reduce((sum, r) => sum + (Number(r.cash_amount) || 0), 0);
}

export async function getDailyReconciliation(date) {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from('daily_reconciliations')
    .select('*')
    .eq('reconciliation_date', date)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveDailyReconciliation({ date, declaredCash, actualCash, note }) {
  const discrepancy = actualCash - declaredCash;
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured — reconciliation not persisted.');
    return {
      id: Date.now(),
      reconciliation_date: date,
      declared_cash: declaredCash,
      actual_cash: actualCash,
      discrepancy,
      note,
    };
  }
  const { data, error } = await supabase
    .from('daily_reconciliations')
    .upsert(
      {
        reconciliation_date: date,
        declared_cash: declaredCash,
        actual_cash: actualCash,
        discrepancy,
        note,
      },
      { onConflict: 'reconciliation_date' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getReconciliationHistory(limit = 30) {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('daily_reconciliations')
    .select('*')
    .order('reconciliation_date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function getShiftsInRange(startDate, endDate) {
  if (!isSupabaseConfigured) return mockShifts;
  const { data, error } = await supabase
    .from('shifts')
    .select('*, staff(name)')
    .gte('shift_date', startDate)
    .lte('shift_date', endDate)
    .order('shift_date', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getExpensesInRange(startDate, endDate) {
  if (!isSupabaseConfigured) return mockExpenseList;
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .gte('spent_at', startDate)
    .lte('spent_at', endDate)
    .order('spent_at', { ascending: false });
  if (error) throw error;
  return data;
}

// ---------- Salary payments ----------
export async function getSalaryPayments(staffId) {
  if (!isSupabaseConfigured) return mockSalaryPayments;
  let q = supabase.from('salary_payments').select('*, staff(name)').order('paid_at', { ascending: false });
  if (staffId) q = q.eq('staff_id', staffId);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function addSalaryPayment(payment) {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured — payment not persisted:', payment);
    return { ...payment, id: Date.now() };
  }
  const { data, error } = await supabase.from('salary_payments').insert([payment]).select().single();
  if (error) throw error;
  return data;
}

// ---------- Credit / Udhaar customers ----------
export async function getCreditCustomers() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('credit_customers')
    .select('*')
    .eq('active', true)
    .order('name');
  if (error) throw error;
  return data;
}

export async function deactivateCreditCustomer(id) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('credit_customers').update({ active: false }).eq('id', id);
  if (error) throw error;
}

export async function addCreditCustomer(customer) {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured — customer not persisted:', customer);
    return { ...customer, id: Date.now() };
  }
  const { data, error } = await supabase.from('credit_customers').insert([customer]).select().single();
  if (error) throw error;
  return data;
}

export async function getAllCreditTransactions() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('credit_transactions')
    .select('*, credit_customers(name)')
    .order('transaction_date', { ascending: false })
    .order('id', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getCustomerTransactions(customerId) {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('credit_transactions')
    .select('*')
    .eq('customer_id', customerId)
    .order('transaction_date', { ascending: false })
    .order('id', { ascending: false });
  if (error) throw error;
  return data;
}

export async function addCreditTransaction(tx) {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured — transaction not persisted:', tx);
    return { ...tx, id: Date.now() };
  }
  const { data, error } = await supabase.from('credit_transactions').insert([tx]).select().single();
  if (error) throw error;
  return data;
}

export async function deleteCreditTransaction(id) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('credit_transactions').delete().eq('id', id);
  if (error) throw error;
}

// ---------- Roles & permissions ----------

// Returns { role: 'owner' | 'manager' } for the signed-in user, or
// null if no user_profiles row exists yet for them (e.g. the owner
// hasn't run the one-time setup step from migration v10 yet).
export async function getMyProfile() {
  if (!isSupabaseConfigured) return { role: 'owner', full_name: 'Demo Owner' };
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return null;
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userData.user.id)
    .maybeSingle();
  if (error) {
    console.error('getMyProfile failed:', error);
    return null;
  }
  return data;
}

// ---------- Activity log (owner-only) ----------

export async function getActivityLog(limit = 200) {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('activity_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

// ---------- Staff edit/deactivate (owner-only, enforced by RLS too) ----------

export async function updateStaff(id, fields) {
  if (!isSupabaseConfigured) return;
  const { data, error } = await supabase.from('staff').update(fields).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function setStaffActive(id, active) {
  if (!isSupabaseConfigured) return;
  const { data, error } = await supabase.from('staff').update({ active }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// ---------- Suppliers (fuel purchase ledger) ----------

export async function getSuppliers() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('suppliers').select('*').eq('active', true).order('name');
  if (error) throw error;
  return data;
}

// Used by the Suppliers management page (shows inactive too, so they
// can be reactivated). Delivery form's dropdown should keep using
// getSuppliers() above — only active suppliers should show there.
export async function getAllSuppliers() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('suppliers').select('*').order('active', { ascending: false }).order('name');
  if (error) throw error;
  return data;
}

export async function addSupplier(supplier) {
  if (!isSupabaseConfigured) return { ...supplier, id: Date.now() };
  const { data, error } = await supabase.from('suppliers').insert([supplier]).select().single();
  if (error) throw error;
  return data;
}

export async function updateSupplier(id, fields) {
  if (!isSupabaseConfigured) return;
  const { data, error } = await supabase.from('suppliers').update(fields).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function setSupplierActive(id, active) {
  if (!isSupabaseConfigured) return;
  const { data, error } = await supabase.from('suppliers').update({ active }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// All deliveries across all suppliers — used to compute each
// supplier's balance owed (delivery cost - amount_paid, summed).
export async function getAllDeliveriesForLedger() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('tank_deliveries')
    .select('id, supplier_id, liters, rate_per_liter, amount_paid, delivered_at')
    .not('supplier_id', 'is', null);
  if (error) throw error;
  return data;
}

export async function getSupplierPayments(supplierId) {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('supplier_payments')
    .select('*')
    .eq('supplier_id', supplierId)
    .order('paid_at', { ascending: false })
    .order('id', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getAllSupplierPayments() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('supplier_payments').select('*');
  if (error) throw error;
  return data;
}

export async function addSupplierPayment(payment) {
  if (!isSupabaseConfigured) return { ...payment, id: Date.now() };
  const { data, error } = await supabase.from('supplier_payments').insert([payment]).select().single();
  if (error) throw error;
  return data;
}

export async function deleteSupplierPayment(id) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('supplier_payments').delete().eq('id', id);
  if (error) throw error;
}

// ---------- Month-End Archive (owner-only) ----------

export async function getArchivedPeriods() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('archived_periods')
    .select('*')
    .order('period_end', { ascending: false });
  if (error) throw error;
  return data;
}

export async function archivePeriod({ periodLabel, periodStart, periodEnd, totalsSnapshot, archivedByName }) {
  if (!isSupabaseConfigured) return { id: Date.now() };
  const { data, error } = await supabase
    .from('archived_periods')
    .insert([
      {
        period_label: periodLabel,
        period_start: periodStart,
        period_end: periodEnd,
        totals_snapshot: totalsSnapshot,
        archived_by_name: archivedByName,
      },
    ])
    .select()
    .single();
  if (error) throw error;
  return data;
}
