import { useEffect, useState } from 'react';
import { getPrices, getPriceHistory, setPrice } from '../lib/api';

const FUELS = [
  { id: 'petrol', label: 'Petrol', tag: 'bg-primary/15 text-primaryLight' },
  { id: 'diesel', label: 'Diesel', tag: 'bg-emeraldLight/15 text-emeraldLight' },
  { id: 'hioctane', label: 'Hi-Octane', tag: 'bg-warn/15 text-warnLight' },
];

export default function Pricing() {
  const [prices, setPrices] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  function load() {
    setLoading(true);
    Promise.all([getPrices(), getPriceHistory()])
      .then(([p, h]) => {
        setPrices(p);
        setHistory(h);
      })
      .catch((err) => {
        console.error('Failed to load prices:', err);
        setStatus({ type: 'error', msg: 'Could not load prices. Refresh and try again.' });
      })
      .finally(() => setLoading(false));
  }

  async function handleSave(fuelType) {
    const val = Number(input);
    if (!val || val <= 0) {
      setStatus({ type: 'error', msg: 'Enter a valid price.' });
      return;
    }
    setSaving(true);
    try {
      await setPrice(fuelType, val);
      const label = FUELS.find((f) => f.id === fuelType)?.label || fuelType;
      setStatus({ type: 'success', msg: `${label} price updated to Rs ${val.toFixed(2)}.` });
      setEditing(null);
      load();
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', msg: 'Could not update price.' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="font-sans text-muted text-sm py-10 text-center">Loading prices…</div>;

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-3.5">
        <h2 className="font-display text-lg text-ivory uppercase tracking-wide font-bold">Current Prices</h2>
        <div className="flex-1 primary-divider" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-4">
        {FUELS.map((f) => {
          const current = prices.find((p) => p.fuel_type === f.id);
          return (
            <div key={f.id} className="glass-panel p-5">
              <span className={`px-2.5 py-0.5 rounded-full text-[10.5px] ${f.tag}`}>{f.label}</span>
              {editing === f.id ? (
                <div className="mt-3 flex gap-2">
                  <input
                    autoFocus
                    type="number"
                    step="0.01"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    className="w-full bg-obsidian border border-hairline rounded-lg px-3 py-2 font-sans text-sm text-ivory outline-none focus:border-primary/40"
                    placeholder="0.00"
                  />
                  <button
                    onClick={() => handleSave(f.id)}
                    disabled={saving}
                    className="font-sans text-[11px] text-emeraldLight border border-emeraldLight/30 rounded-lg px-3 hover:bg-emeraldLight/10 disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <div className="mt-3 flex justify-between items-center">
                  <span className="font-display text-2xl text-ivory">
                    {current ? `Rs ${Number(current.price_per_liter).toFixed(2)}` : '—'}
                  </span>
                  <button
                    onClick={() => {
                      setEditing(f.id);
                      setInput(current ? String(current.price_per_liter) : '');
                      setStatus(null);
                    }}
                    className="font-sans text-[11px] text-muted hover:text-primaryLight underline decoration-dotted underline-offset-4"
                  >
                    Update
                  </button>
                </div>
              )}
              <div className="font-sans text-[10.5px] text-mutedDim mt-2">
                Effective: {current?.effective_date || '—'}
              </div>
            </div>
          );
        })}
      </div>

      {status && (
        <div
          className={`font-sans text-[12.5px] px-4 py-2.5 rounded-lg border mb-6 max-w-xl ${
            status.type === 'success'
              ? 'border-emeraldLight/30 text-emeraldLight bg-emeraldLight/5'
              : 'border-warnLight/30 text-warnLight bg-warnLight/5'
          }`}
        >
          {status.msg}
        </div>
      )}

      <div className="flex items-center gap-2.5 mb-3.5">
        <h2 className="font-display text-lg text-ivory uppercase tracking-wide font-bold">Price History</h2>
        <div className="flex-1 primary-divider" />
      </div>
      <div className="glass-panel p-5">
        <div className="overflow-x-auto">
        <table className="w-full border-collapse font-sans text-[12.5px]">
          <thead>
            <tr>
              {['Date', 'Fuel', 'Price / Liter'].map((h) => (
                <th
                  key={h}
                  className="text-left text-[10px] tracking-[0.1em] uppercase text-muted font-medium pb-2.5 border-b border-hairline"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.length === 0 && (
              <tr>
                <td colSpan={3} className="py-6 text-center text-mutedDim">
                  No price changes logged yet.
                </td>
              </tr>
            )}
            {history.map((row) => {
              const f = FUELS.find((x) => x.id === row.fuel_type);
              return (
                <tr key={row.id} className="border-b border-hairline/50 last:border-none">
                  <td className="py-2.5 text-ivory">{row.effective_date}</td>
                  <td className="py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10.5px] ${f?.tag}`}>{f?.label}</span>
                  </td>
                  <td className="py-2.5 text-primaryLight font-semibold">
                    Rs {Number(row.price_per_liter).toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
