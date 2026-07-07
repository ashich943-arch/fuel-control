import { useEffect, useState } from 'react';
import StatPlate from '../components/StatPlate';
import TankGauge from '../components/TankGauge';
import WeeklyChart from '../components/WeeklyChart';
import ShiftsTable from '../components/ShiftsTable';
import PriceTicker from '../components/PriceTicker';
import LowStockAlert from '../components/LowStockAlert';
import { getTanks, getPrices, getRecentShifts, getTodayTotals, getWeeklyThroughput, deleteShift, getPumps, getDailyReconciliation, getShiftsInRange, getAvgFuelCostPerLiter } from '../lib/api';
import { daysAgoString } from '../lib/date';

export default function Overview({ onNavigate, isOwner }) {
  const [tanks, setTanks] = useState([]);
  const [pumps, setPumps] = useState([]);
  const [prices, setPrices] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [totals, setTotals] = useState({ totalSales: 0, litersToday: 0, expenses: 0, byFuel: {} });
  const [avgFuelCost, setAvgFuelCost] = useState({});
  const [weekly, setWeekly] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reconciliationReminder, setReconciliationReminder] = useState(false);

  useEffect(() => {
    load();
    checkYesterdayReconciliation();
  }, []);

  async function checkYesterdayReconciliation() {
    try {
      const yesterday = daysAgoString(1);
      const [existing, yesterdayShifts] = await Promise.all([
        getDailyReconciliation(yesterday),
        getShiftsInRange(yesterday, yesterday),
      ]);
      // Only nag if yesterday actually had sales — no point reminding
      // about a day the station was closed or nothing was logged.
      setReconciliationReminder(!existing && (yesterdayShifts?.length || 0) > 0);
    } catch (err) {
      console.error('Failed to check yesterday\'s reconciliation:', err);
    }
  }

  async function load() {
    try {
      const [t, p, s, tot, w, pmp, avgCost] = await Promise.all([
        getTanks(),
        getPrices(),
        getRecentShifts(),
        getTodayTotals(),
        getWeeklyThroughput(),
        getPumps(),
        getAvgFuelCostPerLiter(),
      ]);
      setTanks(t);
      setPrices(p);
      setShifts(s);
      setTotals(tot);
      setWeekly(w);
      setPumps(pmp);
      setAvgFuelCost(avgCost);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteShift(shift) {
    if (!window.confirm('Delete this shift entry? Tank stock will be adjusted back and any Udhaar entry it created will be removed too.')) return;
    try {
      // Resolve the exact tank via the shift's pump — NOT by fuel_type alone,
      // since two tanks can share a fuel type. Guessing by fuel_type here
      // would silently credit the wrong tank if that ever happens.
      const pump = pumps.find((p) => p.name === shift.pump);
      const tank = tanks.find((t) => t.id === pump?.tank_id);
      if (!tank) {
        console.error('Could not resolve tank for shift', shift, { pump, pumps, tanks });
        alert(
          !pump
            ? `Can't delete this shift: no pump named "${shift.pump}" was found. It may have been renamed or removed. Check Tank Inventory → Pump Assignment.`
            : `Can't delete this shift: pump "${shift.pump}" isn't assigned to a tank. Check Tank Inventory → Pump Assignment, then try again.`
        );
        return;
      }
      // Atomic: reverts the tank stock, deletes any Udhaar/credit
      // transaction this shift created, and deletes the shift — all
      // in one database transaction (delete_shift_and_revert in
      // migrations-history/supabase-schema-v9-*.sql). Previously this
      // was 2 separate calls and left orphaned Udhaar entries behind.
      await deleteShift(shift.id, tank.id);
      await load();
    } catch (err) {
      console.error('Failed to delete shift:', err);
      alert(err?.message?.includes('owner') ? err.message : 'Could not delete shift.');
    }
  }

  if (loading) {
    return <div className="font-sans text-muted text-sm py-10 text-center">Loading dashboard…</div>;
  }

  const fuelTypesSoldToday = Object.keys(totals.byFuel || {});
  const missingCostData = fuelTypesSoldToday.some((fuel) => !avgFuelCost[fuel]);
  const fuelCostToday = fuelTypesSoldToday.reduce(
    (sum, fuel) => sum + (totals.byFuel[fuel] || 0) * (avgFuelCost[fuel] || 0),
    0
  );
  const trueProfit = totals.totalSales - fuelCostToday - totals.expenses;

  return (
    <div>
      {reconciliationReminder && (
        <div className="mb-4 px-4 py-3 rounded-lg border border-warnLight/30 bg-warnLight/10 font-sans text-[12.5px] text-warn flex items-center justify-between flex-wrap gap-2">
          <span>Yesterday's cash reconciliation hasn't been done yet.</span>
          <button
            onClick={() => onNavigate?.('reconciliation')}
            className="font-medium underline decoration-dotted underline-offset-4 hover:text-warnLight"
          >
            Do it now →
          </button>
        </div>
      )}
      <LowStockAlert tanks={tanks} onGoToInventory={() => onNavigate?.('inventory')} />
      <PriceTicker prices={prices} tanks={tanks} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-6">
        <StatPlate
          label="Today's Sales"
          value={Math.round(totals.totalSales)}
          prefix="Rs "
          accent
          trend={totals.totalSales === 0 ? { dir: 'down', value: 'No shifts logged yet', label: '' } : null}
        />
        <StatPlate
          label="Net Profit (Today)"
          value={Math.round(trueProfit)}
          prefix="Rs "
          trend={{
            dir: missingCostData ? 'down' : trueProfit >= 0 ? 'up' : 'down',
            value:
              fuelTypesSoldToday.length === 0
                ? 'No shifts logged yet'
                : missingCostData
                ? '⚠ No delivery cost recorded yet — this understates fuel cost'
                : `Sales − Fuel Cost (Rs ${Math.round(fuelCostToday).toLocaleString('en-IN')}) − Expenses`,
            label: '',
          }}
        />
        <StatPlate label="Liters Dispensed" value={Math.round(totals.litersToday)} />
        <StatPlate
          label="Expenses (Today)"
          value={Math.round(totals.expenses)}
          prefix="Rs "
          trend={totals.expenses === 0 ? { dir: 'down', value: 'None logged', label: '' } : null}
        />
      </div>

      <div className="flex items-center gap-2.5 mb-3.5">
        <h2 className="font-display text-lg text-ivory uppercase tracking-wide font-bold">Tank Levels</h2>
        <div className="flex-1 primary-divider" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-6">
        {tanks.map((t) => (
          <TankGauge key={t.id} name={t.name} liters={t.current_liters} capacity={t.capacity_liters} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-3.5 mb-6">
        <WeeklyChart weekly={weekly} />
        <div className="glass-panel p-5">
          <div className="plate-label mb-3">Current Prices / Liter</div>
          <div className="flex flex-col gap-3.5">
            {prices.map((p) => (
              <div key={p.fuel_type} className="flex justify-between items-center">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10.5px] ${
                    p.fuel_type === 'petrol'
                      ? 'bg-primary/15 text-primaryLight'
                      : p.fuel_type === 'diesel'
                      ? 'bg-emeraldLight/15 text-emeraldLight'
                      : 'bg-warn/15 text-warnLight'
                  }`}
                >
                  {p.fuel_type === 'hioctane' ? 'Hi-Octane' : p.fuel_type[0].toUpperCase() + p.fuel_type.slice(1)}
                </span>
                <span className="font-display text-xl text-ivory">Rs {Number(p.price_per_liter).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="font-sans text-[10.5px] text-mutedDim mt-4">
            Last revised: {prices[0]?.effective_date || '—'}
          </div>
        </div>
      </div>

      <ShiftsTable shifts={shifts} onDelete={isOwner ? handleDeleteShift : undefined} />
    </div>
  );
}
