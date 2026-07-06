import { useEffect, useState } from 'react';
import {
  getAllSuppliers,
  addSupplier,
  updateSupplier,
  setSupplierActive,
  getAllDeliveriesForLedger,
  getAllSupplierPayments,
  addSupplierPayment,
  deleteSupplierPayment,
} from '../lib/api';
import { openPrintWindow } from '../lib/print';
import { localDateString } from '../lib/date';
import { FUEL_LABEL } from '../lib/fuelTypes';

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const [supForm, setSupForm] = useState({ name: '', phone: '', address: '', fuel_type: '', notes: '' });
  const [editingId, setEditingId] = useState(null);
  const [payForm, setPayForm] = useState({ amount: '', note: '' });
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  function load() {
    setLoading(true);
    Promise.all([getAllSuppliers(), getAllDeliveriesForLedger(), getAllSupplierPayments()])
      .then(([s, d, p]) => {
        setSuppliers(s);
        setDeliveries(d);
        setPayments(p);
      })
      .catch((err) => {
        console.error('Failed to load supplier data:', err);
        setStatus({ type: 'error', msg: 'Could not load supplier data. Refresh and try again.' });
      })
      .finally(() => setLoading(false));
  }

  // Balance owed to a supplier = (cost - amount already paid) summed
  // across their deliveries, minus payments made to them since.
  function balanceFor(supplierId) {
    const owedFromDeliveries = deliveries
      .filter((d) => d.supplier_id === supplierId)
      .reduce((s, d) => s + Number(d.liters) * Number(d.rate_per_liter) - Number(d.amount_paid || 0), 0);
    const paid = payments
      .filter((p) => p.supplier_id === supplierId)
      .reduce((s, p) => s + Number(p.amount), 0);
    return owedFromDeliveries - paid;
  }

  function ledgerFor(supplierId) {
    const deliveryRows = deliveries
      .filter((d) => d.supplier_id === supplierId)
      .map((d) => ({
        kind: 'delivery',
        date: d.delivered_at ? localDateString(new Date(d.delivered_at)) : null,
        amount: Number(d.liters) * Number(d.rate_per_liter) - Number(d.amount_paid || 0),
        detail: `${Number(d.liters).toLocaleString()} L delivery`,
        id: `d${d.id}`,
      }));
    const paymentRows = payments
      .filter((p) => p.supplier_id === supplierId)
      .map((p) => ({
        kind: 'payment',
        date: p.paid_at,
        amount: -Number(p.amount),
        detail: p.note || 'Payment',
        id: p.id,
      }));
    return [...deliveryRows, ...paymentRows].sort((a, b) => (a.date < b.date ? 1 : -1));
  }

  function startEdit(s) {
    setEditingId(s.id);
    setSupForm({ name: s.name, phone: s.phone || '', address: s.address || '', fuel_type: s.fuel_type || '', notes: s.notes || '' });
    setStatus(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setSupForm({ name: '', phone: '', address: '', fuel_type: '', notes: '' });
  }

  async function handleSaveSupplier(e) {
    e.preventDefault();
    if (!supForm.name) {
      setStatus({ type: 'error', msg: 'Enter supplier name.' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: supForm.name,
        phone: supForm.phone,
        address: supForm.address,
        fuel_type: supForm.fuel_type || null,
        notes: supForm.notes,
      };
      if (editingId) {
        await updateSupplier(editingId, payload);
        setStatus({ type: 'success', msg: `${supForm.name} updated.` });
      } else {
        await addSupplier(payload);
        setStatus({ type: 'success', msg: `${supForm.name} added.` });
      }
      cancelEdit();
      load();
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', msg: editingId ? 'Could not update supplier.' : 'Could not add supplier.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(s) {
    if (s.active) {
      const bal = balanceFor(s.id);
      if (bal > 0) {
        alert(`${s.name} is still owed Rs ${Math.round(bal).toLocaleString('en-IN')}. Settle it first before marking them inactive.`);
        return;
      }
      if (!window.confirm(`Mark ${s.name} as inactive? They'll disappear from the delivery dropdown, but history stays intact.`)) return;
    }
    try {
      await setSupplierActive(s.id, !s.active);
      load();
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', msg: 'Could not update supplier status.' });
    }
  }

  async function handleAddPayment(e) {
    e.preventDefault();
    if (!payForm.amount || Number(payForm.amount) <= 0) {
      setStatus({ type: 'error', msg: 'Enter a valid amount.' });
      return;
    }
    setSaving(true);
    try {
      await addSupplierPayment({
        supplier_id: selected.id,
        amount: Number(payForm.amount),
        note: payForm.note,
        paid_at: localDateString(),
      });
      setPayForm({ amount: '', note: '' });
      setStatus({ type: 'success', msg: `Payment of Rs ${Number(payForm.amount).toLocaleString('en-IN')} recorded.` });
      load();
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', msg: 'Could not save payment.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePayment(id) {
    if (!window.confirm('Delete this payment record? The balance owed will go back up.')) return;
    try {
      await deleteSupplierPayment(id);
      load();
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', msg: 'Could not delete payment.' });
    }
  }

  function printStatement(supplier) {
    const ledger = ledgerFor(supplier.id).slice().reverse();
    const balance = balanceFor(supplier.id);
    const rows = ledger
      .map(
        (r) => `
        <tr>
          <td>${r.date || '—'}</td>
          <td>${r.kind === 'delivery' ? 'Delivery' : 'Payment'}${r.detail ? ` (${r.detail})` : ''}</td>
          <td class="right">${r.amount >= 0 ? '+' : '−'}Rs ${Math.abs(Math.round(r.amount)).toLocaleString('en-IN')}</td>
        </tr>`
      )
      .join('');

    openPrintWindow(
      'Supplier Statement',
      `
      <table>
        <tr><td class="label">Supplier</td><td class="right">${supplier.name}</td></tr>
        ${supplier.phone ? `<tr><td class="label">Phone</td><td class="right">${supplier.phone}</td></tr>` : ''}
      </table>
      <div class="divider"></div>
      <table>
        <tr><td class="label">Date</td><td class="label">Type</td><td class="label right">Amount</td></tr>
        ${rows || '<tr><td colspan="3">No activity yet.</td></tr>'}
        <tr class="total-row">
          <td colspan="2">Balance Owed</td>
          <td class="right">Rs ${Math.round(balance).toLocaleString('en-IN')}</td>
        </tr>
      </table>
      `
    );
  }

  if (loading) return <div className="font-sans text-muted text-sm py-10 text-center">Loading suppliers…</div>;

  const selectedLedger = selected ? ledgerFor(selected.id) : [];

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-3.5">
        <h2 className="font-display text-lg text-ivory uppercase tracking-wide font-bold">Suppliers</h2>
        <div className="flex-1 primary-divider" />
      </div>

      <div className="glass-panel p-5 mb-6">
        {suppliers.length === 0 ? (
          <div className="font-sans text-mutedDim text-sm py-4 text-center">No suppliers added yet.</div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full border-collapse font-sans text-[12.5px]">
            <thead>
              <tr>
                {['Name', 'Phone', 'Fuel', 'Balance Owed', 'Status', ''].map((h) => (
                  <th key={h} className="text-left text-[10px] tracking-[0.1em] uppercase text-muted font-medium pb-2.5 border-b border-hairline">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => {
                const bal = balanceFor(s.id);
                return (
                  <tr key={s.id} className={`border-b border-hairline/50 last:border-none ${!s.active ? 'opacity-50' : ''}`}>
                    <td className="py-2.5 text-ivory">{s.name}</td>
                    <td className="py-2.5 text-muted">{s.phone || '—'}</td>
                    <td className="py-2.5 text-muted">{s.fuel_type ? FUEL_LABEL[s.fuel_type] : 'Any'}</td>
                    <td className={`py-2.5 font-semibold ${bal > 0 ? 'text-primaryDim' : 'text-emerald'}`}>
                      Rs {Math.round(bal).toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5">
                      <span className={`text-[10.5px] px-2 py-0.5 rounded-full ${s.active ? 'bg-emeraldLight/15 text-emeraldLight' : 'bg-mutedDim/15 text-mutedDim'}`}>
                        {s.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => setSelected(s)} className="font-sans text-[11px] text-primaryDim hover:text-primary underline decoration-dotted underline-offset-4 mr-3">
                        Open ledger
                      </button>
                      <button onClick={() => startEdit(s)} className="font-sans text-[11px] text-muted hover:text-ivory mr-3">
                        Edit
                      </button>
                      <button onClick={() => handleToggleActive(s)} className="font-sans text-[11px] text-mutedDim hover:text-warn">
                        {s.active ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2.5 mb-3.5">
        <h2 className="font-display text-lg text-ivory uppercase tracking-wide font-bold">{editingId ? 'Edit Supplier' : 'Add Supplier'}</h2>
        <div className="flex-1 primary-divider" />
      </div>
      <form onSubmit={handleSaveSupplier} className="glass-panel p-6 max-w-xl flex flex-col gap-4 mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <input
            type="text" placeholder="Supplier name" value={supForm.name}
            onChange={(e) => setSupForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full bg-obsidian border border-hairline rounded-lg px-4 py-2.5 font-sans text-sm text-ivory outline-none focus:border-primary/40"
          />
          <input
            type="text" placeholder="Phone" value={supForm.phone}
            onChange={(e) => setSupForm((f) => ({ ...f, phone: e.target.value }))}
            className="w-full bg-obsidian border border-hairline rounded-lg px-4 py-2.5 font-sans text-sm text-ivory outline-none focus:border-primary/40"
          />
        </div>
        <input
          type="text" placeholder="Address (optional)" value={supForm.address}
          onChange={(e) => setSupForm((f) => ({ ...f, address: e.target.value }))}
          className="w-full bg-obsidian border border-hairline rounded-lg px-4 py-2.5 font-sans text-sm text-ivory outline-none focus:border-primary/40"
        />
        <select
          value={supForm.fuel_type}
          onChange={(e) => setSupForm((f) => ({ ...f, fuel_type: e.target.value }))}
          className="w-full bg-obsidian border border-hairline rounded-lg px-4 py-2.5 font-sans text-sm text-ivory outline-none focus:border-primary/40"
        >
          <option value="">Supplies any fuel</option>
          {Object.entries(FUEL_LABEL).map(([id, label]) => (
            <option key={id} value={id}>{label} only</option>
          ))}
        </select>
        <input
          type="text" placeholder="Notes (optional)" value={supForm.notes}
          onChange={(e) => setSupForm((f) => ({ ...f, notes: e.target.value }))}
          className="w-full bg-obsidian border border-hairline rounded-lg px-4 py-2.5 font-sans text-sm text-ivory outline-none focus:border-primary/40"
        />
        <div className="flex gap-2">
          <button
            type="submit" disabled={saving}
            className="flex-1 py-2.5 rounded-lg bg-primary text-white font-sans text-sm font-medium tracking-wide hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {editingId ? 'Update Supplier' : 'Add Supplier'}
          </button>
          {editingId && (
            <button
              type="button" onClick={cancelEdit}
              className="px-4 py-2.5 rounded-lg border border-hairline font-sans text-sm text-muted hover:text-ivory transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {selected && (
        <div className="glass-panel p-6 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
            <div>
              <div className="plate-label mb-1">Ledger</div>
              <div className="font-display text-lg text-ivory font-bold">{selected.name}</div>
              <div className="font-sans text-[12px] text-mutedDim mt-1">
                Balance owed: <span className="text-primaryDim font-semibold">Rs {Math.round(balanceFor(selected.id)).toLocaleString('en-IN')}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => printStatement(selected)}
                className="font-sans text-[12px] font-medium text-primaryDim border border-primary/30 rounded-lg px-3.5 py-2 hover:bg-primary/10 transition-colors"
              >
                Print Statement
              </button>
              <button
                onClick={() => setSelected(null)}
                className="font-sans text-[12px] text-muted border border-hairline rounded-lg px-3.5 py-2 hover:text-ivory"
              >
                Close
              </button>
            </div>
          </div>

          <form onSubmit={handleAddPayment} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="flex flex-col gap-3.5">
              <div className="plate-label">Record a Payment</div>
              <input
                type="number" placeholder="Amount (Rs)" value={payForm.amount}
                onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))}
                className="w-full bg-obsidian border border-hairline rounded-lg px-4 py-2.5 font-sans text-lg text-ivory outline-none focus:border-primary/40"
              />
              <input
                type="text" placeholder="Note (optional)" value={payForm.note}
                onChange={(e) => setPayForm((f) => ({ ...f, note: e.target.value }))}
                className="w-full bg-obsidian border border-hairline rounded-lg px-4 py-2.5 font-sans text-sm text-ivory outline-none focus:border-primary/40"
              />
              <button
                type="submit" disabled={saving}
                className="w-full py-2.5 rounded-lg bg-primary text-white font-sans text-sm font-medium tracking-wide hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Record Payment'}
              </button>
            </div>

            <div className="glass-panel p-4 bg-obsidian">
              <div className="plate-label mb-2">Recent Activity</div>
              {selectedLedger.length === 0 ? (
                <div className="font-sans text-mutedDim text-sm py-4 text-center">No deliveries or payments yet.</div>
              ) : (
                <div className="flex flex-col gap-2 max-h-52 overflow-y-auto">
                  {selectedLedger.map((r) => (
                    <div key={r.id} className="flex justify-between items-center font-sans text-[12px]">
                      <span className="text-muted">{r.date} · {r.detail}</span>
                      <div className="flex items-center gap-2">
                        <span className={r.kind === 'delivery' ? 'text-primaryDim font-semibold' : 'text-emerald font-semibold'}>
                          {r.amount >= 0 ? '+' : '−'}Rs {Math.abs(Math.round(r.amount)).toLocaleString('en-IN')}
                        </span>
                        {r.kind === 'payment' && (
                          <button
                            onClick={() => handleDeletePayment(r.id)}
                            className="text-mutedDim hover:text-warn"
                            title="Delete"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </form>
        </div>
      )}

      {status && (
        <div className={`font-sans text-[12.5px] px-4 py-2.5 rounded-lg border mb-6 max-w-xl ${
          status.type === 'success' ? 'border-emeraldLight/30 text-emerald bg-emeraldLight/5' : 'border-warnLight/30 text-warn bg-warnLight/5'
        }`}>
          {status.msg}
        </div>
      )}
    </div>
  );
}
