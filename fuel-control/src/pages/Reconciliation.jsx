import { useEffect, useState } from 'react';
import { getDeclaredCashForDate, getDailyReconciliation, saveDailyReconciliation, getReconciliationHistory } from '../lib/api';
import { localDateString } from '../lib/date';

export default function Reconciliation() {
  const [date, setDate] = useState(localDateString());
  const [declaredCash, setDeclaredCash] = useState(0);
  const [existing, setExisting] = useState(null);
  const [actualInput, setActualInput] = useState('');
  const [note, setNote] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  function load() {
    setLoading(true);
    Promise.all([getDeclaredCashForDate(date), getDailyReconciliation(date), getReconciliationHistory()])
      .then(([declared, existingRow, hist]) => {
        setDeclaredCash(declared);
        setExisting(existingRow);
        setActualInput(existingRow ? String(existingRow.actual_cash) : '');
        setNote(existingRow?.note || '');
        setHistory(hist);
      })
      .catch((err) => {
        console.error('Failed to load reconciliation data:', err);
        setStatus({ type: 'error', msg: 'Could not load reconciliation data. Refresh and try again.' });
      })
      .finally(() => setLoading(false));
  }

  async function handleSave(e) {
    e.preventDefault();
    if (actualInput === '') return;
    setSaving(true);
    setStatus(null);
    try {
      const saved = await saveDailyReconciliation({
        date,
        declaredCash,
        actualCash: Number(actualInput),
        note,
      });
      setExisting(saved);
      setHistory((prev) => [saved, ...prev.filter((h) => h.reconciliation_date !== date)]);
      setStatus({ type: 'success', msg: 'Reconciliation saved.' });
    } catch (err) {
      console.error('Failed to save reconciliation:', err);
      setStatus({ type: 'error', msg: 'Could not save reconciliation. Try again.' });
    } finally {
      setSaving(false);
    }
  }

  const discrepancy = actualInput !== '' ? Number(actualInput) - declaredCash : null;

  if (loading) return <div className="font-sans text-muted text-sm py-10 text-center">Loading…</div>;

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-3.5">
        <h2 className="font-display text-lg text-ivory uppercase tracking-wide font-bold">Cash Reconciliation</h2>
        <div className="flex-1 primary-divider" />
      </div>
      <p className="font-sans text-[11px] text-mutedDim mb-5 max-w-xl">
        One check per day. Count the physical cash at closing time and enter it below — it's compared
        against the total cash declared across all of that day's shifts.
      </p>

      <form onSubmit={handleSave} className="glass-panel p-6 max-w-lg flex flex-col gap-5 mb-8">
        <div>
          <label className="plate-label block mb-2">Date</label>
          <input
            type="date" value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full bg-obsidian border border-hairline rounded-lg px-4 py-2.5 font-sans text-sm text-ivory outline-none focus:border-primary/40"
          />
        </div>

        <div className="glass-panel p-4 bg-obsidian flex justify-between items-center">
          <span className="plate-label mb-0">System declared cash</span>
          <span className="font-display text-xl text-ivory font-bold">Rs {declaredCash.toLocaleString('en-IN')}</span>
        </div>

        {existing && Number(existing.declared_cash) !== declaredCash && (
          <div className="font-sans text-[11px] text-warn -mt-2">
            Heads up: this was Rs {Number(existing.declared_cash).toLocaleString('en-IN')} when you last saved it — a shift for this date may have been added, edited, or deleted since. Saving again will reconcile against the new total.
          </div>
        )}

        <div>
          <label className="plate-label block mb-2">Actual Cash Counted (Rs)</label>
          <input
            type="number" value={actualInput}
            onChange={(e) => setActualInput(e.target.value)}
            placeholder="0"
            className="w-full bg-obsidian border border-hairline rounded-lg px-4 py-3 font-sans text-lg text-ivory outline-none focus:border-primary/40"
          />
        </div>

        {discrepancy !== null && (
          <div className={`font-sans text-[13px] font-semibold px-4 py-2.5 rounded-lg border ${
            discrepancy === 0 ? 'border-emeraldLight/30 text-emerald bg-emeraldLight/5'
            : discrepancy > 0 ? 'border-emeraldLight/30 text-emerald bg-emeraldLight/5'
            : 'border-warnLight/30 text-warn bg-warnLight/5'
          }`}>
            {discrepancy === 0 ? '✓ Matched' : discrepancy > 0 ? `Over by Rs ${discrepancy.toLocaleString('en-IN')}` : `Short by Rs ${Math.abs(discrepancy).toLocaleString('en-IN')}`}
          </div>
        )}

        <div>
          <label className="plate-label block mb-2">Note (optional)</label>
          <input
            type="text" value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Rs 500 short — attendant will bring tomorrow"
            className="w-full bg-obsidian border border-hairline rounded-lg px-4 py-2.5 font-sans text-sm text-ivory outline-none focus:border-primary/40"
          />
        </div>

        {status && (
          <div className={`font-sans text-[12.5px] px-4 py-2.5 rounded-lg border ${
            status.type === 'success' ? 'border-emeraldLight/30 text-emerald bg-emeraldLight/5' : 'border-warnLight/30 text-warn bg-warnLight/5'
          }`}>
            {status.msg}
          </div>
        )}

        <button
          type="submit" disabled={saving || actualInput === ''}
          className="w-full py-3 rounded-lg bg-primary text-white font-sans text-sm font-medium tracking-wide hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? 'Saving…' : existing ? 'Update' : 'Save Reconciliation'}
        </button>
      </form>

      <div className="flex items-center gap-2.5 mb-3.5">
        <h2 className="font-display text-lg text-ivory uppercase tracking-wide font-bold">History</h2>
        <div className="flex-1 primary-divider" />
      </div>
      <div className="glass-panel p-5">
        {history.length === 0 ? (
          <div className="font-sans text-mutedDim text-sm py-4 text-center">No reconciliations recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full border-collapse font-sans text-[12.5px]">
            <thead>
              <tr>
                {['Date', 'Declared', 'Counted', 'Result', 'Note'].map((h) => (
                  <th key={h} className="text-left text-[10px] tracking-[0.1em] uppercase text-muted font-medium pb-2.5 border-b border-hairline">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-b border-hairline/50 last:border-none">
                  <td className="py-2.5 text-ivory">{h.reconciliation_date}</td>
                  <td className="py-2.5 text-muted">Rs {Number(h.declared_cash).toLocaleString('en-IN')}</td>
                  <td className="py-2.5 text-muted">Rs {Number(h.actual_cash).toLocaleString('en-IN')}</td>
                  <td className={`py-2.5 font-semibold ${Number(h.discrepancy) === 0 ? 'text-emerald' : Number(h.discrepancy) > 0 ? 'text-emerald' : 'text-warn'}`}>
                    {Number(h.discrepancy) === 0 ? '✓ Matched' : Number(h.discrepancy) > 0 ? `+Rs ${Number(h.discrepancy).toLocaleString('en-IN')}` : `−Rs ${Math.abs(Number(h.discrepancy)).toLocaleString('en-IN')}`}
                  </td>
                  <td className="py-2.5 text-mutedDim">{h.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
