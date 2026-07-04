import { useEffect, useState } from 'react';
import TankGauge from '../components/TankGauge';
import {
  getTanks,
  addDelivery,
  deleteDelivery,
  adjustTankLevel,
  updateTankCapacity,
  updateTankThreshold,
  addTank,
  getPumps,
  addPump,
  updatePumpTank,
  getDeliveries,
  getShiftsInRange,
} from '../lib/api';
import { localDateString, daysAgoString } from '../lib/date';

const FUEL_OPTIONS = [
  { id: 'petrol', label: 'Petrol' },
  { id: 'diesel', label: 'Diesel' },
  { id: 'hioctane', label: 'Hi-Octane' },
];

function last7DayRange() {
  return { start: daysAgoString(6), end: localDateString() };
}

export default function Inventory() {
  const [tanks, setTanks] = useState([]);
  const [pumps, setPumps] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [avgDailyByFuel, setAvgDailyByFuel] = useState({});
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ tank_id: '', liters: '', rate: '', supplier: '' });
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);

  const [editingCapacity, setEditingCapacity] = useState(null);
  const [capacityInput, setCapacityInput] = useState('');
  const [editingThreshold, setEditingThreshold] = useState(null);
  const [thresholdInput, setThresholdInput] = useState('');

  const [newTank, setNewTank] = useState({ name: '', fuel_type: 'petrol', capacity_liters: '' });
  const [newPumpName, setNewPumpName] = useState('');

  useEffect(() => {
    load();
  }, []);

  function load() {
    setLoading(true);
    const { start, end } = last7DayRange();
    Promise.all([getTanks(), getDeliveries(), getShiftsInRange(start, end), getPumps()])
      .then(([t, d, shifts, pmp]) => {
        setTanks(t);
        setDeliveries(d);
        setPumps(pmp);
        setForm((f) => ({ ...f, tank_id: f.tank_id || t[0]?.id || '' }));

        const byFuel = {};
        for (const s of shifts) {
          const liters = Math.max(0, Number(s.closing_reading) - Number(s.opening_reading));
          byFuel[s.fuel_type] = (byFuel[s.fuel_type] || 0) + liters;
        }
        const avg = {};
        for (const fuel of Object.keys(byFuel)) avg[fuel] = byFuel[fuel] / 7;
        setAvgDailyByFuel(avg);
      })
      .catch((err) => {
        console.error('Failed to load inventory data:', err);
        setStatus({ type: 'error', msg: 'Could not load tank/inventory data. Refresh and try again.' });
      })
      .finally(() => setLoading(false));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.tank_id) {
      setStatus({ type: 'error', msg: 'Add a tank first — see the form below.' });
      return;
    }
    if (!form.liters || !form.rate) {
      setStatus({ type: 'error', msg: 'Enter liters and rate per liter.' });
      return;
    }
    const tank = tanks.find((t) => t.id === Number(form.tank_id));
    // This is just for the "capped at capacity" message shown to the
    // user — the actual clamped value is computed atomically inside
    // the database by adjust_tank_level(), not trusted from here.
    const wouldBe = (tank?.current_liters || 0) + Number(form.liters);
    const overflow = tank && wouldBe > tank.capacity_liters;

    setSaving(true);
    setStatus(null);
    try {
      const saved = await addDelivery({
        tank_id: Number(form.tank_id),
        liters: Number(form.liters),
        rate_per_liter: Number(form.rate),
        supplier: form.supplier || 'Unnamed supplier',
        delivered_at: new Date().toISOString(),
      });
      if (tank) {
        const newLevel = await adjustTankLevel(tank.id, Number(form.liters));
        setTanks((prev) => prev.map((t) => (t.id === tank.id ? { ...t, current_liters: newLevel ?? t.current_liters } : t)));
      }
      setDeliveries((prev) => [{ ...saved, tanks: { fuel_type: tank?.fuel_type, name: tank?.name } }, ...prev]);
      setStatus({
        type: overflow ? 'warn' : 'success',
        msg: overflow
          ? `Delivery recorded, but ${form.liters} L exceeds this tank's remaining space — level capped at capacity. Check tank capacity is set correctly.`
          : `Recorded delivery of ${form.liters} L.`,
      });
      setForm((f) => ({ ...f, liters: '', rate: '', supplier: '' }));
    } catch (err) {
      console.error('Failed to save delivery:', err);
      setStatus({ type: 'error', msg: 'Could not save delivery. Try again.' });
    } finally {
      setSaving(false);
    }
  }

  async function saveCapacity(tankId) {
    const val = Number(capacityInput);
    if (!val || val <= 0) return;
    try {
      await updateTankCapacity(tankId, val);
      setTanks((prev) => prev.map((t) => (t.id === tankId ? { ...t, capacity_liters: val } : t)));
      setEditingCapacity(null);
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', msg: 'Could not update capacity.' });
    }
  }

  async function saveThreshold(tankId) {
    const val = Number(thresholdInput);
    if (val < 0 || val > 100 || Number.isNaN(val)) return;
    try {
      await updateTankThreshold(tankId, val);
      setTanks((prev) => prev.map((t) => (t.id === tankId ? { ...t, low_stock_threshold_pct: val } : t)));
      setEditingThreshold(null);
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', msg: 'Could not update threshold.' });
    }
  }

  async function handleDeleteDelivery(delivery) {
    if (!window.confirm(`Delete this delivery of ${Number(delivery.liters).toLocaleString()} L? Tank stock will be reduced back.`)) return;
    try {
      const tank = tanks.find((t) => t.id === delivery.tank_id);
      if (tank) {
        const revertedLevel = await adjustTankLevel(tank.id, -Number(delivery.liters));
        setTanks((prev) => prev.map((t) => (t.id === tank.id ? { ...t, current_liters: revertedLevel ?? t.current_liters } : t)));
      }
      await deleteDelivery(delivery.id);
      setDeliveries((prev) => prev.filter((d) => d.id !== delivery.id));
      setStatus({ type: 'success', msg: 'Delivery deleted and tank stock reverted.' });
    } catch (err) {
      console.error('Failed to delete delivery:', err);
      setStatus({ type: 'error', msg: 'Could not delete delivery.' });
    }
  }

  async function handleAddTank(e) {
    e.preventDefault();
    if (!newTank.name || !newTank.capacity_liters) {
      setStatus({ type: 'error', msg: 'Enter a tank name and capacity.' });
      return;
    }
    try {
      const saved = await addTank({
        name: newTank.name,
        fuel_type: newTank.fuel_type,
        capacity_liters: Number(newTank.capacity_liters),
        current_liters: 0,
        low_stock_threshold_pct: 25,
      });
      setTanks((prev) => [...prev, saved]);
      setNewTank({ name: '', fuel_type: 'petrol', capacity_liters: '' });
      setStatus({ type: 'success', msg: `${saved.name} added. Assign a pump to it below.` });
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', msg: 'Could not add tank.' });
    }
  }

  async function handleAddPump(e) {
    e.preventDefault();
    if (!newPumpName) return;
    try {
      const saved = await addPump({ name: newPumpName, tank_id: null });
      setPumps((prev) => [...prev, { ...saved, tanks: null }]);
      setNewPumpName('');
      setStatus({ type: 'success', msg: `${newPumpName} added — assign it to a tank above before using it in Shift Entry.` });
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', msg: 'Could not add pump.' });
    }
  }

  async function handleAssignPump(pumpId, tankId) {
    try {
      await updatePumpTank(pumpId, Number(tankId));
      const tank = tanks.find((t) => t.id === Number(tankId));
      setPumps((prev) =>
        prev.map((p) => (p.id === pumpId ? { ...p, tank_id: Number(tankId), tanks: tank ? { name: tank.name, fuel_type: tank.fuel_type } : null } : p))
      );
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', msg: 'Could not reassign pump.' });
    }
  }

  const supplierRows = (() => {
    const bySupplier = {};
    for (const d of deliveries) {
      const name = d.supplier || 'Unnamed supplier';
      if (!bySupplier[name]) bySupplier[name] = { liters: 0, cost: 0, count: 0, last: d.delivered_at };
      bySupplier[name].liters += Number(d.liters);
      bySupplier[name].cost += Number(d.liters) * Number(d.rate_per_liter);
      bySupplier[name].count += 1;
      if (d.delivered_at > bySupplier[name].last) bySupplier[name].last = d.delivered_at;
    }
    return Object.entries(bySupplier).sort((a, b) => b[1].liters - a[1].liters);
  })();

  if (loading) return <div className="font-sans text-muted text-sm py-10 text-center">Loading tanks…</div>;

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-3.5">
        <h2 className="font-display text-lg text-ivory uppercase tracking-wide font-bold">Tank Inventory</h2>
        <div className="flex-1 gold-divider" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-4">
        {tanks.map((t) => {
          const threshold = t.low_stock_threshold_pct ?? 25;
          const avgDaily = avgDailyByFuel[t.fuel_type] || 0;
          const daysLeft = avgDaily > 0 ? t.current_liters / avgDaily : null;
          return (
            <div key={t.id}>
              <TankGauge name={t.name} liters={t.current_liters} capacity={t.capacity_liters} />
              <div className="mt-2 text-center flex flex-col gap-1.5 items-center">
                {editingCapacity === t.id ? (
                  <div className="flex gap-2 items-center justify-center">
                    <input
                      type="number" autoFocus value={capacityInput}
                      onChange={(e) => setCapacityInput(e.target.value)}
                      className="w-24 bg-obsidian border border-hairline rounded-lg px-2 py-1.5 font-sans text-xs text-ivory outline-none focus:border-gold/40"
                      placeholder="Liters"
                    />
                    <button onClick={() => saveCapacity(t.id)} className="font-sans text-[11px] text-emerald border border-emeraldLight/30 rounded-lg px-2.5 py-1.5 hover:bg-emeraldLight/10">Save</button>
                    <button onClick={() => setEditingCapacity(null)} className="font-sans text-[11px] text-muted border border-hairline rounded-lg px-2.5 py-1.5 hover:text-ivory">Cancel</button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setEditingCapacity(t.id); setCapacityInput(String(t.capacity_liters)); }}
                    className="font-sans text-[11px] text-muted hover:text-goldDim underline decoration-dotted underline-offset-4"
                  >
                    Edit capacity ({t.capacity_liters.toLocaleString()} L)
                  </button>
                )}

                {editingThreshold === t.id ? (
                  <div className="flex gap-2 items-center justify-center">
                    <input
                      type="number" autoFocus value={thresholdInput}
                      onChange={(e) => setThresholdInput(e.target.value)}
                      className="w-16 bg-obsidian border border-hairline rounded-lg px-2 py-1.5 font-sans text-xs text-ivory outline-none focus:border-gold/40"
                      placeholder="%"
                    />
                    <button onClick={() => saveThreshold(t.id)} className="font-sans text-[11px] text-emerald border border-emeraldLight/30 rounded-lg px-2.5 py-1.5 hover:bg-emeraldLight/10">Save</button>
                    <button onClick={() => setEditingThreshold(null)} className="font-sans text-[11px] text-muted border border-hairline rounded-lg px-2.5 py-1.5 hover:text-ivory">Cancel</button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setEditingThreshold(t.id); setThresholdInput(String(threshold)); }}
                    className="font-sans text-[11px] text-muted hover:text-goldDim underline decoration-dotted underline-offset-4"
                  >
                    Low-stock alert at {threshold}%
                  </button>
                )}

                <div className="font-sans text-[10.5px] text-mutedDim">
                  {daysLeft !== null
                    ? daysLeft < 999
                      ? `~${Math.max(0, Math.round(daysLeft))} day${Math.round(daysLeft) === 1 ? '' : 's'} of stock left`
                      : ''
                    : 'Not enough sales history yet'}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="font-sans text-[11px] text-mutedDim mb-8 max-w-xl">
        Stock estimate is based on the average daily liters sold over the last 7 days. Set each tank's
        real capacity and alert threshold above — that's what levels and warnings are calculated against.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 mb-8">
        <div className="glass-panel p-6">
          <div className="plate-label mb-3.5">Add a Tank</div>
          <p className="font-sans text-[11px] text-mutedDim mb-4">
            Add a second tank for the same fuel type if you have more than one storage tank on site.
          </p>
          <form onSubmit={handleAddTank} className="flex flex-col gap-3.5">
            <input
              type="text" placeholder="Tank name, e.g. Petrol Tank 2" value={newTank.name}
              onChange={(e) => setNewTank((f) => ({ ...f, name: e.target.value }))}
              className="w-full bg-obsidian border border-hairline rounded-lg px-4 py-2.5 font-sans text-sm text-ivory outline-none focus:border-gold/40"
            />
            <div className="grid grid-cols-2 gap-3">
              <select
                value={newTank.fuel_type}
                onChange={(e) => setNewTank((f) => ({ ...f, fuel_type: e.target.value }))}
                className="w-full bg-obsidian border border-hairline rounded-lg px-3 py-2.5 font-sans text-sm text-ivory outline-none focus:border-gold/40"
              >
                {FUEL_OPTIONS.map((f) => (
                  <option key={f.id} value={f.id}>{f.label}</option>
                ))}
              </select>
              <input
                type="number" placeholder="Capacity (L)" value={newTank.capacity_liters}
                onChange={(e) => setNewTank((f) => ({ ...f, capacity_liters: e.target.value }))}
                className="w-full bg-obsidian border border-hairline rounded-lg px-3 py-2.5 font-sans text-sm text-ivory outline-none focus:border-gold/40"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-lg bg-gold text-white font-sans text-sm font-medium tracking-wide hover:opacity-90 transition-opacity"
            >
              Add Tank
            </button>
          </form>
        </div>

        <div className="glass-panel p-6">
          <div className="plate-label mb-3.5">Pump → Tank Assignment</div>
          <p className="font-sans text-[11px] text-mutedDim mb-4">
            Each pump must point to exactly one tank — this is what Shift Entry uses to know which
            tank's stock to deduct, so it's essential once you have more than one tank per fuel type.
          </p>
          <div className="flex flex-col gap-3 mb-4">
            {pumps.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3">
                <span className="font-sans text-[13px] text-ivory font-medium w-14 shrink-0">{p.name}</span>
                <select
                  value={p.tank_id || ''}
                  onChange={(e) => handleAssignPump(p.id, e.target.value)}
                  className="flex-1 bg-obsidian border border-hairline rounded-lg px-3 py-2 font-sans text-[12.5px] text-ivory outline-none focus:border-gold/40"
                >
                  <option value="">Unassigned</option>
                  {tanks.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({FUEL_OPTIONS.find((f) => f.id === t.fuel_type)?.label})</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <form onSubmit={handleAddPump} className="flex gap-2">
            <input
              type="text" placeholder="New pump name, e.g. P-4" value={newPumpName}
              onChange={(e) => setNewPumpName(e.target.value)}
              className="flex-1 bg-obsidian border border-hairline rounded-lg px-3 py-2 font-sans text-[12.5px] text-ivory outline-none focus:border-gold/40"
            />
            <button
              type="submit"
              className="font-sans text-[12px] font-medium text-white bg-gold rounded-lg px-4 py-2 hover:opacity-90 transition-opacity shrink-0"
            >
              Add Pump
            </button>
          </form>
        </div>
      </div>

      <div className="flex items-center gap-2.5 mb-5">
        <h2 className="font-display text-lg text-ivory uppercase tracking-wide font-bold">Record a Delivery</h2>
        <div className="flex-1 gold-divider" />
      </div>

      <form onSubmit={handleSubmit} className="glass-panel p-6 max-w-xl flex flex-col gap-5 mb-8">
        <div>
          <label className="plate-label block mb-2">Tank</label>
          <select
            value={form.tank_id}
            onChange={(e) => setForm((f) => ({ ...f, tank_id: e.target.value }))}
            className="w-full bg-obsidian border border-hairline rounded-lg px-4 py-3 font-sans text-sm text-ivory outline-none focus:border-gold/40"
          >
            {tanks.length === 0 && <option value="">No tanks yet — add one below first</option>}
            {tanks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} — {(t.capacity_liters - t.current_liters).toLocaleString()} L space left
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="plate-label block mb-2">Liters Delivered</label>
            <input
              type="number" min="0" value={form.liters}
              onChange={(e) => setForm((f) => ({ ...f, liters: e.target.value }))}
              placeholder="0"
              className="w-full bg-obsidian border border-hairline rounded-lg px-4 py-3 font-sans text-sm text-ivory outline-none focus:border-gold/40"
            />
          </div>
          <div>
            <label className="plate-label block mb-2">Rate / Liter (Rs)</label>
            <input
              type="number" min="0" step="0.01" value={form.rate}
              onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))}
              placeholder="0.00"
              className="w-full bg-obsidian border border-hairline rounded-lg px-4 py-3 font-sans text-sm text-ivory outline-none focus:border-gold/40"
            />
          </div>
        </div>

        <div>
          <label className="plate-label block mb-2">Supplier</label>
          <input
            type="text" value={form.supplier}
            onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))}
            placeholder="e.g. PSO Depot Sargodha"
            className="w-full bg-obsidian border border-hairline rounded-lg px-4 py-3 font-sans text-sm text-ivory outline-none focus:border-gold/40"
          />
        </div>

        {status && (
          <div className={`font-sans text-[12.5px] px-4 py-2.5 rounded-lg border ${
            status.type === 'success' ? 'border-emeraldLight/30 text-emerald bg-emeraldLight/5'
            : status.type === 'warn' ? 'border-warnLight/30 text-warn bg-warnLight/5'
            : 'border-warnLight/30 text-warn bg-warnLight/5'
          }`}>
            {status.msg}
          </div>
        )}

        <button
          type="submit" disabled={saving}
          className="w-full py-3 rounded-lg bg-gold text-white font-sans text-sm font-medium tracking-wide hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Record Delivery'}
        </button>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        <div className="glass-panel p-5">
          <div className="plate-label mb-3">Delivery History</div>
          {deliveries.length === 0 ? (
            <div className="font-sans text-mutedDim text-sm py-4 text-center">No deliveries recorded yet.</div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              <div className="overflow-x-auto">
              <table className="w-full border-collapse font-sans text-[12.5px]">
                <thead>
                  <tr>
                    {['Date', 'Tank', 'Liters', 'Rate', 'Supplier', ''].map((h) => (
                      <th key={h} className="text-left text-[10px] tracking-[0.1em] uppercase text-muted font-medium pb-2.5 border-b border-hairline sticky top-0 bg-panel">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map((d) => (
                    <tr key={d.id} className="border-b border-hairline/50 last:border-none">
                      <td className="py-2.5 text-muted">{new Date(d.delivered_at).toLocaleDateString('en-GB')}</td>
                      <td className="py-2.5 text-ivory">{d.tanks?.name || '—'}</td>
                      <td className="py-2.5 text-muted">{Number(d.liters).toLocaleString()} L</td>
                      <td className="py-2.5 text-muted">Rs {Number(d.rate_per_liter).toFixed(2)}</td>
                      <td className="py-2.5 text-goldDim">{d.supplier}</td>
                      <td className="py-2.5 text-right">
                        <button
                          onClick={() => handleDeleteDelivery(d)}
                          className="font-sans text-[11px] text-mutedDim hover:text-warn"
                          title="Delete"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </div>

        <div className="glass-panel p-5">
          <div className="plate-label mb-3">Supplier Directory</div>
          {supplierRows.length === 0 ? (
            <div className="font-sans text-mutedDim text-sm py-4 text-center">No suppliers yet — record a delivery to populate this.</div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full border-collapse font-sans text-[12.5px]">
              <thead>
                <tr>
                  {['Supplier', 'Deliveries', 'Total Liters', 'Avg Rate'].map((h) => (
                    <th key={h} className="text-left text-[10px] tracking-[0.1em] uppercase text-muted font-medium pb-2.5 border-b border-hairline">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {supplierRows.map(([name, v]) => (
                  <tr key={name} className="border-b border-hairline/50 last:border-none">
                    <td className="py-2.5 text-ivory">{name}</td>
                    <td className="py-2.5 text-muted">{v.count}</td>
                    <td className="py-2.5 text-muted">{Math.round(v.liters).toLocaleString()} L</td>
                    <td className="py-2.5 text-goldDim font-semibold">Rs {(v.cost / v.liters).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
