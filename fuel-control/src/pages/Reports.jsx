import { useEffect, useState } from 'react';
import { getShiftsInRange, getExpensesInRange, getDeliveriesInRange, getCreditCustomers, getAllCreditTransactions } from '../lib/api';
import { downloadCSV } from '../lib/exportCsv';
import { localDateString, daysAgoString } from '../lib/date';
import { FUEL_LABEL, FUEL_TAG_CLASS } from '../lib/fuelTypes';

const RANGES = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
];

function rangeToDates(range) {
  const now = new Date();
  const end = localDateString(now);
  let start;
  if (range === 'today') {
    start = end;
  } else if (range === 'week') {
    start = daysAgoString(6);
  } else {
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    start = localDateString(d);
  }
  return { start, end };
}

export default function Reports() {
  const [range, setRange] = useState('week');
  const [shifts, setShifts] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [outstandingCredit, setOutstandingCredit] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { start, end } = rangeToDates(range);
    setLoading(true);
    Promise.all([getShiftsInRange(start, end), getExpensesInRange(start, end), getDeliveriesInRange(start, end)])
      .then(([s, e, d]) => {
        setShifts(s || []);
        setExpenses(e || []);
        setDeliveries(d || []);
      })
      .catch((err) => console.error('Failed to load report data:', err))
      .finally(() => setLoading(false));
  }, [range]);

  useEffect(() => {
    Promise.all([getCreditCustomers(), getAllCreditTransactions()])
      .then(([customers, tx]) => {
        const activeIds = new Set(customers.map((c) => c.id));
        const balance = tx
          .filter((t) => activeIds.has(t.customer_id))
          .reduce((sum, t) => sum + (t.type === 'credit_sale' ? Number(t.amount) : -Number(t.amount)), 0);
        setOutstandingCredit(balance);
      })
      .catch((err) => console.error('Failed to load outstanding credit:', err));
  }, []);

  const shiftsWithLiters = shifts.map((s) => {
    const liters = Math.max(0, Number(s.closing_reading) - Number(s.opening_reading));
    const amount = liters * Number(s.price_per_liter);
    return { ...s, liters, amount };
  });

  const totalSales = shiftsWithLiters.reduce((sum, s) => sum + s.amount, 0);
  const totalLiters = shiftsWithLiters.reduce((sum, s) => sum + s.liters, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const netProfit = totalSales - totalExpenses;

  const byFuel = {};
  for (const s of shiftsWithLiters) {
    if (!byFuel[s.fuel_type]) byFuel[s.fuel_type] = { liters: 0, amount: 0 };
    byFuel[s.fuel_type].liters += s.liters;
    byFuel[s.fuel_type].amount += s.amount;
  }

  const byPayment = { cash: 0, card: 0, easypaisa: 0, jazzcash: 0, credit: 0 };
  for (const s of shifts) {
    byPayment.cash += Number(s.cash_amount) || 0;
    byPayment.card += Number(s.card_amount) || 0;
    byPayment.easypaisa += Number(s.easypaisa_amount) || 0;
    byPayment.jazzcash += Number(s.jazzcash_amount) || 0;
    byPayment.credit += Number(s.credit_amount) || 0;
  }
  const paymentTotal = byPayment.cash + byPayment.card + byPayment.easypaisa + byPayment.jazzcash + byPayment.credit;

  const byStaff = {};
  for (const s of shiftsWithLiters) {
    const name = s.staff?.name || 'Unassigned';
    if (!byStaff[name]) byStaff[name] = { liters: 0, amount: 0, entryCount: 0, duties: new Set() };
    byStaff[name].liters += s.liters;
    byStaff[name].amount += s.amount;
    byStaff[name].entryCount += 1;
    byStaff[name].duties.add(`${s.shift_date}_${s.shift_type}`);
  }
  const staffRows = Object.entries(byStaff)
    .map(([name, v]) => [name, { ...v, dutyCount: v.duties.size }])
    .sort((a, b) => b[1].amount - a[1].amount);

  const byCategory = {};
  for (const e of expenses) {
    if (!byCategory[e.category]) byCategory[e.category] = 0;
    byCategory[e.category] += Number(e.amount);
  }
  const categoryRows = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);

  function exportShiftsCSV() {
    const rows = [
      ['Date', 'Shift', 'Staff', 'Pump', 'Fuel', 'Liters', 'Rate', 'Amount', 'Cash', 'Card', 'Easypaisa', 'JazzCash', 'Credit'],
      ...shiftsWithLiters.map((s) => [
        s.shift_date,
        s.shift_type,
        s.staff?.name || '',
        s.pump,
        FUEL_LABEL[s.fuel_type] || s.fuel_type,
        s.liters.toFixed(1),
        Number(s.price_per_liter).toFixed(2),
        s.amount.toFixed(2),
        s.cash_amount,
        s.card_amount,
        s.easypaisa_amount,
        s.jazzcash_amount,
        s.credit_amount || 0,
      ]),
    ];
    downloadCSV(`shifts-${range}-${localDateString()}.csv`, rows);
  }

  function exportExpensesCSV() {
    const rows = [
      ['Date', 'Category', 'Note', 'Amount'],
      ...expenses.map((e) => [e.spent_at, e.category, e.note || '', Number(e.amount).toFixed(2)]),
    ];
    downloadCSV(`expenses-${range}-${localDateString()}.csv`, rows);
  }

  function exportSummaryCSV() {
    const rows = [
      ['Metric', 'Value'],
      ['Total Sales', totalSales.toFixed(2)],
      ['Net Profit', netProfit.toFixed(2)],
      ['Liters Sold', totalLiters.toFixed(1)],
      ['Total Expenses', totalExpenses.toFixed(2)],
      [],
      ['Fuel', 'Liters', 'Sales'],
      ...Object.entries(byFuel).map(([fuel, v]) => [FUEL_LABEL[fuel], v.liters.toFixed(1), v.amount.toFixed(2)]),
      [],
      ['Payment Method', 'Amount'],
      ['Cash', byPayment.cash.toFixed(2)],
      ['Card', byPayment.card.toFixed(2)],
      ['Easypaisa', byPayment.easypaisa.toFixed(2)],
      ['JazzCash', byPayment.jazzcash.toFixed(2)],
      ['New Credit Given (this period)', byPayment.credit.toFixed(2)],
      ['Total Udhaar Outstanding (right now, all-time)', outstandingCredit.toFixed(2)],
    ];
    downloadCSV(`summary-${range}-${localDateString()}.csv`, rows);
  }

  const costByFuel = {};
  for (const d of deliveries) {
    const fuel = d.tanks?.fuel_type;
    if (!fuel) continue;
    if (!costByFuel[fuel]) costByFuel[fuel] = { liters: 0, cost: 0 };
    costByFuel[fuel].liters += Number(d.liters);
    costByFuel[fuel].cost += Number(d.liters) * Number(d.rate_per_liter);
  }
  const marginRows = Object.entries(byFuel)
    .filter(([fuel]) => costByFuel[fuel] && costByFuel[fuel].liters > 0)
    .map(([fuel, sold]) => {
      const avgCost = costByFuel[fuel].cost / costByFuel[fuel].liters;
      const avgSellPrice = sold.liters > 0 ? sold.amount / sold.liters : 0;
      const marginPerLiter = avgSellPrice - avgCost;
      const totalMargin = marginPerLiter * sold.liters;
      return { fuel, avgCost, avgSellPrice, marginPerLiter, totalMargin, liters: sold.liters };
    });
  const totalMargin = marginRows.reduce((s, r) => s + r.totalMargin, 0);

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <h2 className="font-display text-lg text-ivory uppercase tracking-wide font-bold">Reports</h2>
          <div className="flex-1 primary-divider" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={`px-3.5 py-2 rounded-lg font-sans text-[12.5px] font-medium border transition-colors ${
                range === r.id
                  ? 'bg-primary border-primary text-white'
                  : 'border-hairline text-muted hover:text-ivory'
              }`}
            >
              {r.label}
            </button>
          ))}
          {!loading && (shifts.length > 0 || expenses.length > 0) && (
            <>
              <button
                onClick={exportSummaryCSV}
                className="px-3.5 py-2 rounded-lg font-sans text-[12.5px] font-medium border border-primary/30 text-primaryDim hover:bg-primary/10 transition-colors"
              >
                Export Summary
              </button>
              <button
                onClick={exportShiftsCSV}
                className="px-3.5 py-2 rounded-lg font-sans text-[12.5px] font-medium border border-hairline text-muted hover:text-ivory transition-colors"
              >
                Export Shifts
              </button>
              <button
                onClick={exportExpensesCSV}
                className="px-3.5 py-2 rounded-lg font-sans text-[12.5px] font-medium border border-hairline text-muted hover:text-ivory transition-colors"
              >
                Export Expenses
              </button>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="font-sans text-muted text-sm py-10 text-center">Crunching numbers…</div>
      ) : shifts.length === 0 && expenses.length === 0 ? (
        <div className="glass-panel p-8 text-center font-sans text-mutedDim text-sm">
          No shifts or expenses logged in this period yet.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-6">
            <div className="glass-panel p-5 bg-primary border-primary shadow-primaryglow">
              <div className="font-sans text-[10px] tracking-[0.1em] uppercase text-white/75">Total Sales</div>
              <div className="font-display text-2xl text-white mt-2 font-bold">
                Rs {Math.round(totalSales).toLocaleString('en-IN')}
              </div>
            </div>
            <div className="glass-panel p-5">
              <div className="plate-label">Net Profit</div>
              <div className="font-display text-2xl text-ivory mt-2 font-bold">
                Rs {Math.round(netProfit).toLocaleString('en-IN')}
              </div>
            </div>
            <div className="glass-panel p-5">
              <div className="plate-label">Liters Sold</div>
              <div className="font-display text-2xl text-ivory mt-2 font-bold">
                {Math.round(totalLiters).toLocaleString('en-IN')}
              </div>
            </div>
            <div className="glass-panel p-5">
              <div className="plate-label">Total Expenses</div>
              <div className="font-display text-2xl text-ivory mt-2 font-bold">
                Rs {Math.round(totalExpenses).toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 mb-6">
            <div className="glass-panel p-5">
              <div className="plate-label mb-3.5">Sales by Fuel Type</div>
              {Object.keys(byFuel).length === 0 ? (
                <div className="font-sans text-mutedDim text-sm py-4 text-center">No sales yet.</div>
              ) : (
                <div className="flex flex-col gap-3">
                  {Object.entries(byFuel).map(([fuel, v]) => {
                    const pct = totalSales > 0 ? Math.round((v.amount / totalSales) * 100) : 0;
                    return (
                      <div key={fuel}>
                        <div className="flex justify-between items-center mb-1.5">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10.5px] ${FUEL_TAG_CLASS[fuel]}`}>
                            {FUEL_LABEL[fuel]}
                          </span>
                          <span className="font-sans text-[12.5px] text-ivory font-semibold">
                            Rs {Math.round(v.amount).toLocaleString('en-IN')} · {Math.round(v.liters)} L
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-obsidian overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="glass-panel p-5">
              <div className="flex items-center justify-between mb-3.5">
                <div className="plate-label mb-0">Payment Method Breakdown</div>
                <span className="font-sans text-[10.5px] text-mutedDim">for this period's sales</span>
              </div>
              {paymentTotal === 0 ? (
                <div className="font-sans text-mutedDim text-sm py-4 text-center">No payments logged yet.</div>
              ) : (
                <div className="flex flex-col gap-3">
                  {[
                    ['Cash', byPayment.cash],
                    ['Card', byPayment.card],
                    ['Easypaisa', byPayment.easypaisa],
                    ['JazzCash', byPayment.jazzcash],
                    ['New Credit Given', byPayment.credit],
                  ].map(([label, amount]) => {
                    const pct = paymentTotal > 0 ? Math.round((amount / paymentTotal) * 100) : 0;
                    return (
                      <div key={label}>
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="font-sans text-[12.5px] text-muted">{label}</span>
                          <span className="font-sans text-[12.5px] text-ivory font-semibold">
                            Rs {Math.round(amount).toLocaleString('en-IN')} ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-obsidian overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  <div className="pt-3 mt-1 border-t border-hairline flex justify-between items-center">
                    <span className="font-sans text-[12px] text-mutedDim">
                      Total Udhaar outstanding right now
                      <span className="block text-[10px]">(across all customers, not just this period)</span>
                    </span>
                    <span className="font-display text-lg text-warn font-bold">
                      Rs {Math.round(outstandingCredit).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 mb-6">
            <div className="glass-panel p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="plate-label mb-0">Staff Performance</div>
                <span className="font-sans text-[10px] text-mutedDim">1 duty = 1 attendant's shift, may cover multiple pumps</span>
              </div>
              {staffRows.length === 0 ? (
                <div className="font-sans text-mutedDim text-sm py-4 text-center">No shifts logged yet.</div>
              ) : (
                <div className="overflow-x-auto">
                <table className="w-full border-collapse font-sans text-[12.5px]">
                  <thead>
                    <tr>
                      {['Staff', 'Duties', 'Pump Entries', 'Liters', 'Sales'].map((h) => (
                        <th key={h} className="text-left text-[10px] tracking-[0.1em] uppercase text-muted font-medium pb-2.5 border-b border-hairline">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {staffRows.map(([name, v]) => (
                      <tr key={name} className="border-b border-hairline/50 last:border-none">
                        <td className="py-2.5 text-ivory">{name}</td>
                        <td className="py-2.5 text-ivory font-medium">{v.dutyCount}</td>
                        <td className="py-2.5 text-muted">{v.entryCount}</td>
                        <td className="py-2.5 text-muted">{Math.round(v.liters)} L</td>
                        <td className="py-2.5 text-primaryDim font-semibold">Rs {Math.round(v.amount).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>

            <div className="glass-panel p-5">
              <div className="plate-label mb-3">Expenses by Category</div>
              {categoryRows.length === 0 ? (
                <div className="font-sans text-mutedDim text-sm py-4 text-center">No expenses logged yet.</div>
              ) : (
                <div className="overflow-x-auto">
                <table className="w-full border-collapse font-sans text-[12.5px]">
                  <thead>
                    <tr>
                      {['Category', 'Amount'].map((h) => (
                        <th key={h} className="text-left text-[10px] tracking-[0.1em] uppercase text-muted font-medium pb-2.5 border-b border-hairline">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {categoryRows.map(([cat, amount]) => (
                      <tr key={cat} className="border-b border-hairline/50 last:border-none">
                        <td className="py-2.5 text-ivory">{cat}</td>
                        <td className="py-2.5 text-warn font-semibold">Rs {Math.round(amount).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          </div>

          {marginRows.length > 0 ? (
            <div className="glass-panel p-5">
              <div className="flex items-center justify-between mb-3.5">
                <div className="plate-label mb-0">Fuel Profit Margin (Purchase vs Sale)</div>
                <span className="font-sans text-[12.5px] font-semibold text-emerald">
                  Total margin: Rs {Math.round(totalMargin).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="overflow-x-auto">
              <table className="w-full border-collapse font-sans text-[12.5px]">
                <thead>
                  <tr>
                    {['Fuel', 'Avg Purchase Rate', 'Avg Sale Rate', 'Margin / Liter', 'Liters Sold', 'Total Margin'].map((h) => (
                      <th key={h} className="text-left text-[10px] tracking-[0.1em] uppercase text-muted font-medium pb-2.5 border-b border-hairline">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {marginRows.map((r) => (
                    <tr key={r.fuel} className="border-b border-hairline/50 last:border-none">
                      <td className="py-2.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10.5px] ${FUEL_TAG_CLASS[r.fuel]}`}>
                          {FUEL_LABEL[r.fuel]}
                        </span>
                      </td>
                      <td className="py-2.5 text-muted">Rs {r.avgCost.toFixed(2)}</td>
                      <td className="py-2.5 text-muted">Rs {r.avgSellPrice.toFixed(2)}</td>
                      <td className="py-2.5 text-ivory font-semibold">Rs {r.marginPerLiter.toFixed(2)}</td>
                      <td className="py-2.5 text-muted">{Math.round(r.liters)} L</td>
                      <td className="py-2.5 text-emerald font-semibold">Rs {Math.round(r.totalMargin).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              <p className="font-sans text-[11px] text-mutedDim mt-3">
                Purchase rate is a weighted average across deliveries recorded within this same date range ({RANGES.find((r) => r.id === range)?.label.toLowerCase()}).
              </p>
            </div>
          ) : shiftsWithLiters.length > 0 ? (
            <div className="glass-panel p-5">
              <div className="plate-label mb-2">Fuel Profit Margin (Purchase vs Sale)</div>
              <p className="font-sans text-[12.5px] text-mutedDim">
                No deliveries were recorded in this period, so a purchase-cost margin can't be calculated for {RANGES.find((r) => r.id === range)?.label.toLowerCase()}. Try "This Month" or check Tank Inventory for the last delivery date.
              </p>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
