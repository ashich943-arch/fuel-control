import { useEffect, useState } from 'react';
import { getExpensesToday, addExpense, deleteExpense } from '../lib/api';
import { localDateString } from '../lib/date';

const CATEGORIES = ['Electricity', 'Staff Salary', 'Maintenance', 'Supplies', 'Rent', 'Other'];

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ category: 'Electricity', amount: '', note: '' });
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  function load() {
    setLoading(true);
    getExpensesToday()
      .then(setExpenses)
      .catch((err) => {
        console.error('Failed to load expenses:', err);
        setStatus({ type: 'error', msg: 'Could not load expenses. Refresh and try again.' });
      })
      .finally(() => setLoading(false));
  }

  const todayTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) {
      setStatus({ type: 'error', msg: 'Enter a valid amount.' });
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const saved = await addExpense({
        category: form.category,
        amount: Number(form.amount),
        note: form.note,
        spent_at: localDateString(),
      });
      setExpenses((prev) => [saved, ...prev]);
      setStatus({ type: 'success', msg: `Logged Rs ${Number(form.amount).toLocaleString('en-IN')} under ${form.category}.` });
      setForm((f) => ({ ...f, amount: '', note: '' }));
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', msg: 'Could not save expense.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this expense?')) return;
    try {
      await deleteExpense(id);
      setExpenses((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', msg: 'Could not delete expense.' });
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-3.5">
        <h2 className="font-display text-lg text-ivory uppercase tracking-wide font-bold">Today's Expenses</h2>
        <div className="flex-1 primary-divider" />
      </div>

      <div className="glass-panel p-5 mb-6 max-w-xl flex justify-between items-center">
        <span className="plate-label mb-0">Total spent today</span>
        <span className="font-display text-2xl text-warnLight">Rs {todayTotal.toLocaleString('en-IN')}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-5">
        <form onSubmit={handleSubmit} className="glass-panel p-6 flex flex-col gap-5 h-fit">
          <div>
            <label className="plate-label block mb-2">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="w-full bg-obsidian border border-hairline rounded-lg px-4 py-3 font-sans text-sm text-ivory outline-none focus:border-primary/40"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="plate-label block mb-2">Amount (Rs)</label>
            <input
              type="number"
              min="0"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="0"
              className="w-full bg-obsidian border border-hairline rounded-lg px-4 py-3 font-sans text-lg text-ivory outline-none focus:border-primary/40"
            />
          </div>
          <div>
            <label className="plate-label block mb-2">Note (optional)</label>
            <input
              type="text"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="e.g. Evening shift advance"
              className="w-full bg-obsidian border border-hairline rounded-lg px-4 py-3 font-sans text-sm text-ivory outline-none focus:border-primary/40"
            />
          </div>

          {status && (
            <div
              className={`font-sans text-[12.5px] px-4 py-2.5 rounded-lg border ${
                status.type === 'success'
                  ? 'border-emeraldLight/30 text-emeraldLight bg-emeraldLight/5'
                  : 'border-warnLight/30 text-warnLight bg-warnLight/5'
              }`}
            >
              {status.msg}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 rounded-lg bg-primary text-white font-sans text-sm font-medium tracking-wide hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Log Expense'}
          </button>
        </form>

        <div className="glass-panel p-5">
          <div className="plate-label mb-3">Today's Log</div>
          {loading ? (
            <div className="font-sans text-muted text-sm py-6 text-center">Loading…</div>
          ) : expenses.length === 0 ? (
            <div className="font-sans text-mutedDim text-sm py-6 text-center">No expenses logged today.</div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full border-collapse font-sans text-[12.5px]">
              <thead>
                <tr>
                  {['Category', 'Note', 'Amount', ''].map((h) => (
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
                {expenses.map((e) => (
                  <tr key={e.id} className="border-b border-hairline/50 last:border-none">
                    <td className="py-2.5 text-ivory">{e.category}</td>
                    <td className="py-2.5 text-muted">{e.note || '—'}</td>
                    <td className="py-2.5 text-warn font-semibold">
                      Rs {Number(e.amount).toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        onClick={() => handleDelete(e.id)}
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
          )}
        </div>
      </div>
    </div>
  );
}
