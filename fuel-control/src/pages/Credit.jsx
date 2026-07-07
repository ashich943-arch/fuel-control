import { useEffect, useState } from 'react';
import {
  getCreditCustomers,
  addCreditCustomer,
  updateCreditCustomer,
  deactivateCreditCustomer,
  getAllCreditTransactions,
  getCustomerTransactions,
  addCreditTransaction,
  deleteCreditTransaction,
} from '../lib/api';
import { openPrintWindow } from '../lib/print';
import { localDateString } from '../lib/date';
import { FUEL_LABEL } from '../lib/fuelTypes';
import { STATION_NAME } from '../lib/config';

export default function Credit() {
  const [customers, setCustomers] = useState([]);
  const [allTx, setAllTx] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [customerTx, setCustomerTx] = useState([]);
  const [txLoading, setTxLoading] = useState(false);

  const [custForm, setCustForm] = useState({ name: '', phone: '', address: '', credit_limit: '' });
  const [editingCustomerId, setEditingCustomerId] = useState(null);
  const [txForm, setTxForm] = useState({ type: 'credit_sale', amount: '', fuel_type: 'petrol', liters: '', note: '' });
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  function load() {
    setLoading(true);
    Promise.all([getCreditCustomers(), getAllCreditTransactions()])
      .then(([c, t]) => {
        setCustomers(c);
        setAllTx(t);
      })
      .catch((err) => {
        console.error('Failed to load credit customers/transactions:', err);
        setStatus({ type: 'error', msg: 'Could not load customer data. Refresh and try again.' });
      })
      .finally(() => setLoading(false));
  }

  function balanceFor(customerId) {
    return allTx
      .filter((t) => t.customer_id === customerId)
      .reduce((s, t) => s + (t.type === 'credit_sale' ? Number(t.amount) : -Number(t.amount)), 0);
  }

  async function handleDeactivate(customer) {
    const bal = balanceFor(customer.id);
    if (bal !== 0) {
      alert(`${customer.name} still has a balance of Rs ${Math.round(bal).toLocaleString('en-IN')}. Settle it first before removing them.`);
      return;
    }
    if (!window.confirm(`Remove ${customer.name} from the active customer list? Their transaction history is kept, just hidden from this list.`)) return;
    try {
      await deactivateCreditCustomer(customer.id);
      setCustomers((prev) => prev.filter((c) => c.id !== customer.id));
      if (selected?.id === customer.id) setSelected(null);
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', msg: 'Could not remove customer.' });
    }
  }

  function openCustomer(c) {
    setSelected(c);
    setTxLoading(true);
    setStatus(null);
    getCustomerTransactions(c.id)
      .then(setCustomerTx)
      .finally(() => setTxLoading(false));
  }

  function startEditCustomer(c) {
    setEditingCustomerId(c.id);
    setCustForm({
      name: c.name,
      phone: c.phone || '',
      address: c.address || '',
      credit_limit: String(c.credit_limit || 0),
    });
    setStatus(null);
  }

  function cancelEditCustomer() {
    setEditingCustomerId(null);
    setCustForm({ name: '', phone: '', address: '', credit_limit: '' });
  }

  async function handleSaveCustomer(e) {
    e.preventDefault();
    if (!custForm.name) {
      setStatus({ type: 'error', msg: 'Enter customer name.' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: custForm.name,
        phone: custForm.phone,
        address: custForm.address,
        credit_limit: Number(custForm.credit_limit) || 0,
      };
      if (editingCustomerId) {
        await updateCreditCustomer(editingCustomerId, payload);
        setStatus({ type: 'success', msg: `${custForm.name} updated.` });
      } else {
        await addCreditCustomer(payload);
        setStatus({ type: 'success', msg: `${custForm.name} added.` });
      }
      cancelEditCustomer();
      load();
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', msg: editingCustomerId ? 'Could not update customer.' : 'Could not add customer.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleAddTransaction(e) {
    e.preventDefault();
    if (!txForm.amount || Number(txForm.amount) <= 0) {
      setStatus({ type: 'error', msg: 'Enter a valid amount.' });
      return;
    }
    if (txForm.type === 'credit_sale' && selected.credit_limit > 0) {
      const currentBalance = balanceFor(selected.id);
      const wouldBe = currentBalance + Number(txForm.amount);
      if (wouldBe > selected.credit_limit) {
        const ok = window.confirm(
          `${selected.name}'s balance is Rs ${Math.round(currentBalance).toLocaleString('en-IN')}. ` +
          `Adding this sale takes them to Rs ${Math.round(wouldBe).toLocaleString('en-IN')}, over their Rs ${Number(selected.credit_limit).toLocaleString('en-IN')} limit. Continue anyway?`
        );
        if (!ok) return;
      }
    }
    setSaving(true);
    try {
      const saved = await addCreditTransaction({
        customer_id: selected.id,
        type: txForm.type,
        amount: Number(txForm.amount),
        fuel_type: txForm.type === 'credit_sale' ? txForm.fuel_type : null,
        liters: txForm.type === 'credit_sale' && txForm.liters ? Number(txForm.liters) : null,
        note: txForm.note,
        transaction_date: localDateString(),
      });
      setCustomerTx((prev) => [saved, ...prev]);
      setAllTx((prev) => [{ ...saved, credit_customers: { name: selected.name } }, ...prev]);
      setStatus({
        type: 'success',
        msg: `${txForm.type === 'credit_sale' ? 'Credit sale' : 'Payment'} of Rs ${Number(txForm.amount).toLocaleString('en-IN')} recorded.`,
      });
      setTxForm((f) => ({ ...f, amount: '', liters: '', note: '' }));
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', msg: 'Could not save transaction.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteTx(txId) {
    if (!window.confirm('Delete this transaction? Balance will be recalculated.')) return;
    try {
      await deleteCreditTransaction(txId);
      setCustomerTx((prev) => prev.filter((t) => t.id !== txId));
      setAllTx((prev) => prev.filter((t) => t.id !== txId));
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', msg: 'Could not delete transaction.' });
    }
  }

  // Normalizes common Pakistani phone number formats (0300-1234567,
  // 03001234567, +923001234567, 923001234567) into the digits-only
  // international format wa.me links require (923001234567).
  function normalizePakPhone(phone) {
    const digits = (phone || '').replace(/\D/g, '');
    if (!digits) return null;
    if (digits.startsWith('92')) return digits;
    if (digits.startsWith('0')) return '92' + digits.slice(1);
    return digits;
  }

  function shareOnWhatsApp(customer, transactions) {
    const balance = transactions.reduce(
      (s, t) => s + (t.type === 'credit_sale' ? Number(t.amount) : -Number(t.amount)),
      0
    );
    const waPhone = normalizePakPhone(customer.phone);
    if (!waPhone) {
      alert(`${customer.name} has no phone number on file. Add one first (Edit customer) to share on WhatsApp.`);
      return;
    }
    const message =
      `Assalam-o-Alaikum ${customer.name},\n` +
      `${STATION_NAME} — your current Udhaar balance is Rs ${Math.round(balance).toLocaleString('en-IN')}.\n` +
      `Shukriya.`;
    window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`, '_blank');
  }

  function printStatement(customer, transactions) {
    const balance = transactions.reduce(
      (s, t) => s + (t.type === 'credit_sale' ? Number(t.amount) : -Number(t.amount)),
      0
    );
    const rows = transactions
      .slice()
      .reverse()
      .map(
        (t) => `
        <tr>
          <td>${t.transaction_date}</td>
          <td>${t.type === 'credit_sale' ? 'Sale' : 'Payment'}${t.fuel_type ? ` (${FUEL_LABEL[t.fuel_type]})` : ''}</td>
          <td class="right">${t.type === 'credit_sale' ? '+' : '−'}Rs ${Number(t.amount).toLocaleString('en-IN')}</td>
        </tr>`
      )
      .join('');

    openPrintWindow(
      'Customer Statement',
      `
      <table>
        <tr><td class="label">Customer</td><td class="right">${customer.name}</td></tr>
        ${customer.phone ? `<tr><td class="label">Phone</td><td class="right">${customer.phone}</td></tr>` : ''}
      </table>
      <div class="divider"></div>
      <table>
        <tr><td class="label">Date</td><td class="label">Type</td><td class="label right">Amount</td></tr>
        ${rows || '<tr><td colspan="3">No transactions yet.</td></tr>'}
        <tr class="total-row">
          <td colspan="2">Balance Due</td>
          <td class="right">Rs ${Math.round(balance).toLocaleString('en-IN')}</td>
        </tr>
      </table>
      `
    );
  }

  if (loading) return <div className="font-sans text-muted text-sm py-10 text-center">Loading customers…</div>;

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-3.5">
        <h2 className="font-display text-lg text-ivory uppercase tracking-wide font-bold">Udhaar / Credit Customers</h2>
        <div className="flex-1 primary-divider" />
      </div>

      <div className="glass-panel p-5 mb-6">
        {customers.length === 0 ? (
          <div className="font-sans text-mutedDim text-sm py-4 text-center">No credit customers added yet.</div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full border-collapse font-sans text-[12.5px]">
            <thead>
              <tr>
                {['Name', 'Phone', 'Credit Limit', 'Balance Due', ''].map((h) => (
                  <th key={h} className="text-left text-[10px] tracking-[0.1em] uppercase text-muted font-medium pb-2.5 border-b border-hairline">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => {
                const bal = balanceFor(c.id);
                const overLimit = c.credit_limit > 0 && bal > c.credit_limit;
                return (
                  <tr key={c.id} className="border-b border-hairline/50 last:border-none">
                    <td className="py-2.5 text-ivory">{c.name}</td>
                    <td className="py-2.5 text-muted">{c.phone || '—'}</td>
                    <td className="py-2.5 text-muted">
                      {c.credit_limit > 0 ? `Rs ${Number(c.credit_limit).toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className={`py-2.5 font-semibold ${overLimit ? 'text-warn' : bal > 0 ? 'text-primaryDim' : 'text-emerald'}`}>
                      Rs {Math.round(bal).toLocaleString('en-IN')}
                      {overLimit && <span className="ml-1.5 text-[10px] font-normal">over limit</span>}
                    </td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => openCustomer(c)}
                          className="font-sans text-[11px] text-primaryDim hover:text-primary underline decoration-dotted underline-offset-4"
                        >
                          Open ledger
                        </button>
                        <button
                          onClick={() => startEditCustomer(c)}
                          className="font-sans text-[11px] text-muted hover:text-ivory"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeactivate(c)}
                          className="font-sans text-[11px] text-mutedDim hover:text-warn"
                          title="Remove customer"
                        >
                          ✕
                        </button>
                      </div>
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
        <h2 className="font-display text-lg text-ivory uppercase tracking-wide font-bold">{editingCustomerId ? 'Edit Customer' : 'Add Customer'}</h2>
        <div className="flex-1 primary-divider" />
      </div>
      <form onSubmit={handleSaveCustomer} className="glass-panel p-6 max-w-xl flex flex-col gap-4 mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <input
            type="text" placeholder="Customer name" value={custForm.name}
            onChange={(e) => setCustForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full bg-obsidian border border-hairline rounded-lg px-4 py-2.5 font-sans text-sm text-ivory outline-none focus:border-primary/40"
          />
          <input
            type="text" placeholder="Phone" value={custForm.phone}
            onChange={(e) => setCustForm((f) => ({ ...f, phone: e.target.value }))}
            className="w-full bg-obsidian border border-hairline rounded-lg px-4 py-2.5 font-sans text-sm text-ivory outline-none focus:border-primary/40"
          />
        </div>
        <input
          type="text" placeholder="Address (optional)" value={custForm.address}
          onChange={(e) => setCustForm((f) => ({ ...f, address: e.target.value }))}
          className="w-full bg-obsidian border border-hairline rounded-lg px-4 py-2.5 font-sans text-sm text-ivory outline-none focus:border-primary/40"
        />
        <input
          type="number" placeholder="Credit limit (Rs, optional)" value={custForm.credit_limit}
          onChange={(e) => setCustForm((f) => ({ ...f, credit_limit: e.target.value }))}
          className="w-full bg-obsidian border border-hairline rounded-lg px-4 py-2.5 font-sans text-sm text-ivory outline-none focus:border-primary/40"
        />
        <div className="flex gap-2">
          <button
            type="submit" disabled={saving}
            className="flex-1 py-2.5 rounded-lg bg-primary text-white font-sans text-sm font-medium tracking-wide hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {editingCustomerId ? 'Update Customer' : 'Add Customer'}
          </button>
          {editingCustomerId && (
            <button
              type="button" onClick={cancelEditCustomer}
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
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => shareOnWhatsApp(selected, customerTx)}
                className="font-sans text-[12px] font-medium text-emerald border border-emeraldLight/30 rounded-lg px-3.5 py-2 hover:bg-emeraldLight/10 transition-colors"
              >
                Share on WhatsApp
              </button>
              <button
                onClick={() => printStatement(selected, customerTx)}
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

          <form onSubmit={handleAddTransaction} className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
            <div className="flex flex-col gap-3.5">
              <div className="flex gap-2">
                {['credit_sale', 'payment'].map((t) => (
                  <button
                    type="button" key={t}
                    onClick={() => setTxForm((f) => ({ ...f, type: t }))}
                    className={`flex-1 py-2.5 rounded-lg font-sans text-[13px] border transition-colors ${
                      txForm.type === t ? 'bg-primary/10 border-primary/30 text-primaryDim' : 'border-hairline text-muted hover:text-ivory'
                    }`}
                  >
                    {t === 'credit_sale' ? 'Credit Sale' : 'Payment Received'}
                  </button>
                ))}
              </div>
              {txForm.type === 'credit_sale' && (
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={txForm.fuel_type}
                    onChange={(e) => setTxForm((f) => ({ ...f, fuel_type: e.target.value }))}
                    className="w-full bg-obsidian border border-hairline rounded-lg px-3 py-2.5 font-sans text-sm text-ivory outline-none focus:border-primary/40"
                  >
                    {Object.entries(FUEL_LABEL).map(([id, label]) => (
                      <option key={id} value={id}>{label}</option>
                    ))}
                  </select>
                  <input
                    type="number" placeholder="Liters (optional)" value={txForm.liters}
                    onChange={(e) => setTxForm((f) => ({ ...f, liters: e.target.value }))}
                    className="w-full bg-obsidian border border-hairline rounded-lg px-3 py-2.5 font-sans text-sm text-ivory outline-none focus:border-primary/40"
                  />
                </div>
              )}
              <input
                type="number" placeholder="Amount (Rs)" value={txForm.amount}
                onChange={(e) => setTxForm((f) => ({ ...f, amount: e.target.value }))}
                className="w-full bg-obsidian border border-hairline rounded-lg px-4 py-2.5 font-sans text-lg text-ivory outline-none focus:border-primary/40"
              />
              <input
                type="text" placeholder="Note (optional)" value={txForm.note}
                onChange={(e) => setTxForm((f) => ({ ...f, note: e.target.value }))}
                className="w-full bg-obsidian border border-hairline rounded-lg px-4 py-2.5 font-sans text-sm text-ivory outline-none focus:border-primary/40"
              />
              <button
                type="submit" disabled={saving}
                className="w-full py-2.5 rounded-lg bg-primary text-white font-sans text-sm font-medium tracking-wide hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Record'}
              </button>
            </div>

            <div className="glass-panel p-4 bg-obsidian">
              <div className="plate-label mb-2">Recent Entries</div>
              {txLoading ? (
                <div className="font-sans text-mutedDim text-sm py-4 text-center">Loading…</div>
              ) : customerTx.length === 0 ? (
                <div className="font-sans text-mutedDim text-sm py-4 text-center">No transactions yet.</div>
              ) : (
                <div className="flex flex-col gap-2 max-h-52 overflow-y-auto">
                  {customerTx.map((t) => (
                    <div key={t.id} className="flex justify-between items-center font-sans text-[12px]">
                      <span className="text-muted">{t.transaction_date} · {t.type === 'credit_sale' ? 'Sale' : 'Payment'}</span>
                      <div className="flex items-center gap-2">
                        <span className={t.type === 'credit_sale' ? 'text-primaryDim font-semibold' : 'text-emerald font-semibold'}>
                          {t.type === 'credit_sale' ? '+' : '−'}Rs {Number(t.amount).toLocaleString('en-IN')}
                        </span>
                        <button
                          onClick={() => handleDeleteTx(t.id)}
                          className="text-mutedDim hover:text-warn"
                          title="Delete"
                        >
                          ✕
                        </button>
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
