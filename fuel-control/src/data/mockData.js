export const mockTanks = [
  { id: 1, name: 'Petrol Tank', fuel_type: 'petrol', capacity_liters: 10000, current_liters: 7200, low_stock_threshold_pct: 25 },
  { id: 2, name: 'Diesel Tank', fuel_type: 'diesel', capacity_liters: 10000, current_liters: 4200, low_stock_threshold_pct: 25 },
  { id: 3, name: 'Hi-Octane Tank', fuel_type: 'hioctane', capacity_liters: 3000, current_liters: 2640, low_stock_threshold_pct: 25 },
];

export const mockPrices = [
  { fuel_type: 'petrol', price_per_liter: 272.9, effective_date: '2026-06-28' },
  { fuel_type: 'diesel', price_per_liter: 279.5, effective_date: '2026-06-28' },
  { fuel_type: 'hioctane', price_per_liter: 305.0, effective_date: '2026-06-28' },
];

export const mockStaff = [
  { id: 1, name: 'Bilal Ahmed', role: 'Attendant', monthly_salary: 25000 },
  { id: 2, name: 'Usman Tariq', role: 'Attendant', monthly_salary: 25000 },
];

export const mockShifts = [
  {
    id: 1,
    pump: 'P-1',
    fuel_type: 'petrol',
    shift_type: 'Morning',
    shift_date: '2026-07-02',
    opening_reading: 12000,
    closing_reading: 12240,
    liters: 240,
    price_per_liter: 272.9,
    amount: 240 * 272.9,
    cash_amount: 40000,
    card_amount: 25496,
    easypaisa_amount: 0,
    jazzcash_amount: 0,
    staff: { name: 'Bilal Ahmed' },
  },
  {
    id: 2,
    pump: 'P-2',
    fuel_type: 'diesel',
    shift_type: 'Evening',
    shift_date: '2026-07-02',
    opening_reading: 8000,
    closing_reading: 8180,
    liters: 180,
    price_per_liter: 279.5,
    amount: 180 * 279.5,
    cash_amount: 50310,
    card_amount: 0,
    easypaisa_amount: 0,
    jazzcash_amount: 0,
    staff: { name: 'Usman Tariq' },
  },
];

export const mockSalaryPayments = [
  { id: 1, amount: 25000, type: 'salary', note: 'June salary', paid_at: '2026-06-30', staff: { name: 'Bilal Ahmed' } },
];

export const mockExpensesToday = 12400;

export const mockExpenseList = [
  { id: 1, category: 'Electricity', amount: 4500, note: 'Monthly bill share', spent_at: '2026-07-02' },
  { id: 2, category: 'Staff Salary', amount: 6000, note: 'Evening shift advance', spent_at: '2026-07-02' },
  { id: 3, category: 'Maintenance', amount: 1900, note: 'Pump nozzle repair', spent_at: '2026-07-02' },
];

export const mockWeekly = [
  { day: 'Mon', liters: 5200 },
  { day: 'Tue', liters: 6100 },
  { day: 'Wed', liters: 4800 },
  { day: 'Thu', liters: 6700 },
  { day: 'Fri', liters: 7400 },
  { day: 'Sat', liters: 5600 },
  { day: 'Sun', liters: 4500 },
];
