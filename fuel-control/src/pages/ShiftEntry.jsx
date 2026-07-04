import { useEffect, useState } from 'react';
import { getPrices, getStaff, getLastClosingReading, logShift, getTanks, getPumps, getCreditCustomers, addCreditCustomer, getCustomerTransactions } from '../lib/api';
import { openPrintWindow } from '../lib/print';
import { localDateString } from '../lib/date';

const FUEL_LABEL = { petrol: 'Petrol', diesel: 'Diesel', hioctane: 'Hi-Octane' };
const SHIFT_TYPES = ['Morning', 'Evening', 'Night'];

export default function ShiftEntry() {
  const [prices, setPrices] = useState([]);
  const [staff, setStaff] = useState([]);
  const [tanks, setTanks] = useState([]);
  const [pumps, setPumps] = useState([]);
  const [creditCustomers, setCreditCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [lastSlip, setLastSlip] = useState(null);
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [selectedCustomerBalance, setSelectedCustomerBalance] = useState(null);

  const [form, setForm] = useState({
    staff_id: '',
    pump_id: '',
    shift_type: 'Morning',
    opening_reading: '',
    closing_reading: '',
    cash_amount: '',
    card_amount: '',
    easypaisa_amount: '',
    jazzcash_amount: '',
    credit_amount: '',
    credit_customer_id: '',
  });

  useEffect(() => {
    Promise.all([getPrices(), getStaff(), getTanks(), getPumps(), getCreditCustomers()])
      .then(([p, s, t, pmp, cc]) => {
        setPrices(p);
        setStaff(s);
        setTanks(t);
        setPumps(pmp);
        setCreditCustomers(cc);
        setForm((f) => ({
          ...f,
          staff_id: f.staff_id || s[0]?.id || '',
          pump_id: f.pump_id || pmp[0]?.id || '',
        }));
      })
      .catch((err) => {
        console.error('Failed to load shift entry data:', err);
        setStatus({ type: 'error', msg: 'Could not load setup data (staff/tanks/pumps). Refresh and try again.' });
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedPump = pumps.find((p) => p.id === Number(form.pump_id));
  const tank = tanks.find((t) => t.id === selectedPump?.tank_id);
  const fuelType = tank?.fuel_type;

  // auto-fill opening reading with last closing reading for this pump+fuel
  useEffect(() => {
    if (!selectedPump || !fuelType) return;
    getLastClosingReading(selectedPump.name, fuelType).then((val) => {
      setForm((f) => ({ ...f, opening_reading: val ?? 0 }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.pump_id, fuelType]);

  // Load the selected credit customer's current balance so we can warn
  // (not block) if this credit amount would push them over their limit.
  useEffect(() => {
    if (!form.credit_customer_id) {
      setSelectedCustomerBalance(null);
      return;
    }
    getCustomerTransactions(Number(form.credit_customer_id)).then((txs) => {
      const balance = txs.reduce((s, t) => s + (t.type === 'credit_sale' ? Number(t.amount) : -Number(t.amount)), 0);
      setSelectedCustomerBalance(balance);
    });
  }, [form.credit_customer_id]);

  const selectedCreditCustomer = creditCustomers.find((c) => c.id === Number(form.credit_customer_id));
  const wouldExceedCreditLimit =
    selectedCreditCustomer &&
    selectedCreditCustomer.credit_limit > 0 &&
    selectedCustomerBalance !== null &&
    selectedCustomerBalance + (Number(form.credit_amount) || 0) > selectedCreditCustomer.credit_limit;

  const price = prices.find((p) => p.fuel_type === fuelType)?.price_per_liter || 0;
  const liters =
    form.opening_reading !== '' && form.closing_reading !== ''
      ? Math.max(0, Number(form.closing_reading) - Number(form.opening_reading))
      : 0;
  const amount = liters * price;

  const paymentSplitTotal =
    (Number(form.cash_amount) || 0) +
    (Number(form.card_amount) || 0) +
    (Number(form.easypaisa_amount) || 0) +
    (Number(form.jazzcash_amount) || 0) +
    (Number(form.credit_amount) || 0);
  const splitMismatch = amount > 0 && Math.abs(paymentSplitTotal - amount) > 1;

  const insufficientStock = tank && liters > tank.current_liters;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedPump || !tank) {
      setStatus({ type: 'error', msg: 'This pump has no tank assigned. Fix it in Tank Inventory → Pump Assignment first.' });
      return;
    }
    if (form.closing_reading === '' || Number(form.closing_reading) < Number(form.opening_reading)) {
      setStatus({ type: 'error', msg: 'Closing reading must be greater than or equal to opening reading.' });
      return;
    }
    if (liters === 0) {
      setStatus({ type: 'error', msg: 'No liters sold this shift — check your readings.' });
      return;
    }
    if (!price) {
      setStatus({ type: 'error', msg: 'No price set for this fuel. Set it on the Pricing page first.' });
      return;
    }
    if (insufficientStock) {
      const ok = window.confirm(
        `This shift claims ${liters.toFixed(1)} L sold, but the tank only has ${tank.current_liters.toLocaleString()} L. ` +
        `This usually means a typo in the closing reading. Continue anyway?`
      );
      if (!ok) return;
    }
    if (Number(form.credit_amount) > 0 && !form.credit_customer_id) {
      setStatus({ type: 'error', msg: 'Select which customer this credit amount belongs to.' });
      return;
    }
    if (wouldExceedCreditLimit) {
      const ok = window.confirm(
        `${selectedCreditCustomer.name}'s balance is already Rs ${Math.round(selectedCustomerBalance).toLocaleString('en-IN')}. ` +
        `This will take them over their Rs ${Number(selectedCreditCustomer.credit_limit).toLocaleString('en-IN')} limit. Continue anyway?`
      );
      if (!ok) return;
    }
    setSaving(true);
    setStatus(null);
    try {
      // Atomic: inserts the shift, decrements the tank, and posts the
      // Udhaar transaction (if any) all in one database transaction —
      // see log_shift() in migrations-history/supabase-schema-v9-*.sql
      await logShift({
        shift: {
          staff_id: Number(form.staff_id) || null,
          pump: selectedPump.name,
          fuel_type: fuelType,
          shift_type: form.shift_type,
          shift_date: localDateString(),
          opening_reading: Number(form.opening_reading),
          closing_reading: Number(form.closing_reading),
          price_per_liter: price,
          cash_amount: Number(form.cash_amount) || 0,
          card_amount: Number(form.card_amount) || 0,
          easypaisa_amount: Number(form.easypaisa_amount) || 0,
          jazzcash_amount: Number(form.jazzcash_amount) || 0,
          credit_amount: Number(form.credit_amount) || 0,
        },
        tankId: tank.id,
        creditCustomerId: Number(form.credit_customer_id) || null,
      });
      setTanks((prev) => prev.map((t) => (t.id === tank.id ? { ...t, current_liters: Math.max(0, t.current_liters - liters) } : t)));

      const creditCustomerName =
        Number(form.credit_amount) > 0 && form.credit_customer_id
          ? creditCustomers.find((c) => c.id === Number(form.credit_customer_id))?.name
          : null;

      setStatus({
        type: 'success',
        msg: `Shift logged: ${liters.toFixed(1)} L on ${selectedPump.name} — Rs ${amount.toLocaleString('en-IN')}` +
          (creditCustomerName ? ` (Rs ${Number(form.credit_amount).toLocaleString('en-IN')} added to ${creditCustomerName}'s Udhaar ledger)` : ''),
      });
      setLastSlip({
        staffName: staff.find((s) => s.id === Number(form.staff_id))?.name || '—',
        pump: selectedPump.name,
        fuelLabel: FUEL_LABEL[fuelType],
        shiftType: form.shift_type,
        opening: form.opening_reading,
        closing: form.closing_reading,
        liters,
        price,
        amount,
        cash: Number(form.cash_amount) || 0,
        card: Number(form.card_amount) || 0,
        easypaisa: Number(form.easypaisa_amount) || 0,
        jazzcash: Number(form.jazzcash_amount) || 0,
        credit: Number(form.credit_amount) || 0,
        creditCustomerName,
        date: new Date().toLocaleString('en-GB'),
      });
      setForm((f) => ({
        ...f,
        closing_reading: '',
        cash_amount: '',
        card_amount: '',
        easypaisa_amount: '',
        jazzcash_amount: '',
        credit_amount: '',
        credit_customer_id: '',
      }));
    } catch (err) {
      console.error('Failed to log shift:', err);
      setStatus({ type: 'error', msg: 'Could not save shift. Try again.' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="font-sans text-muted text-sm py-10 text-center">Loading…</div>;

  function printSlip() {
    if (!lastSlip) return;
    const s = lastSlip;
    openPrintWindow(
      'Shift Slip',
      `
      <table>
        <tr><td class="label">Date</td><td class="right">${s.date}</td></tr>
        <tr><td class="label">Staff</td><td class="right">${s.staffName}</td></tr>
        <tr><td class="label">Shift</td><td class="right">${s.shiftType}</td></tr>
        <tr><td class="label">Pump</td><td class="right">${s.pump}</td></tr>
        <tr><td class="label">Fuel</td><td class="right">${s.fuelLabel}</td></tr>
      </table>
      <div class="divider"></div>
      <table>
        <tr><td class="label">Opening</td><td class="right">${s.opening}</td></tr>
        <tr><td class="label">Closing</td><td class="right">${s.closing}</td></tr>
        <tr><td class="label">Liters Sold</td><td class="right">${s.liters.toFixed(1)} L</td></tr>
        <tr><td class="label">Rate</td><td class="right">Rs ${s.price.toFixed(2)}/L</td></tr>
      </table>
      <div class="divider"></div>
      <table>
        ${s.cash ? `<tr><td class="label">Cash</td><td class="right">Rs ${s.cash.toLocaleString('en-IN')}</td></tr>` : ''}
        ${s.card ? `<tr><td class="label">Card</td><td class="right">Rs ${s.card.toLocaleString('en-IN')}</td></tr>` : ''}
        ${s.easypaisa ? `<tr><td class="label">Easypaisa</td><td class="right">Rs ${s.easypaisa.toLocaleString('en-IN')}</td></tr>` : ''}
        ${s.jazzcash ? `<tr><td class="label">JazzCash</td><td class="right">Rs ${s.jazzcash.toLocaleString('en-IN')}</td></tr>` : ''}
        ${s.credit ? `<tr><td class="label">Credit / Udhaar${s.creditCustomerName ? ` (${s.creditCustomerName})` : ''}</td><td class="right">Rs ${s.credit.toLocaleString('en-IN')}</td></tr>` : ''}
        <tr class="total-row"><td>Total</td><td class="right">Rs ${s.amount.toLocaleString('en-IN')}</td></tr>
      </table>
      `
    );
  }

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-2.5 mb-2">
        <h2 className="font-display text-lg text-ivory uppercase tracking-wide font-bold">Log Shift Reading</h2>
        <div className="flex-1 gold-divider" />
      </div>
      <p className="font-sans text-[11px] text-mutedDim mb-5">
        One entry per pump, per shift — not per customer. Enter the meter reading at shift start and end.
      </p>

      {pumps.length === 0 && (
        <div className="glass-panel p-5 mb-5 border-warn bg-warnLight/10 font-sans text-[13px] text-warn">
          No pumps set up yet. Go to Tank Inventory → Pump Assignment to add one.
        </div>
      )}

      <form onSubmit={handleSubmit} className="glass-panel p-6 flex flex-col gap-5">
        <div>
          <label className="plate-label block mb-2">Staff Member</label>
          <select
            value={form.staff_id}
            onChange={(e) => setForm((f) => ({ ...f, staff_id: e.target.value }))}
            className="w-full bg-obsidian border border-hairline rounded-lg px-4 py-3 font-sans text-sm text-ivory outline-none focus:border-gold/40"
          >
            {staff.length === 0 && <option value="">No staff added yet</option>}
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="plate-label block mb-2">Shift</label>
          <div className="flex gap-2">
            {SHIFT_TYPES.map((s) => (
              <button
                type="button" key={s}
                onClick={() => setForm((f) => ({ ...f, shift_type: s }))}
                className={`flex-1 py-2.5 rounded-lg font-sans text-sm border transition-colors ${
                  form.shift_type === s ? 'bg-gold/10 border-gold/30 text-goldDim' : 'border-hairline text-muted hover:text-ivory'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="plate-label block mb-2">Pump</label>
          <div className="flex gap-2 flex-wrap">
            {pumps.map((p) => (
              <button
                type="button" key={p.id}
                onClick={() => setForm((f) => ({ ...f, pump_id: p.id }))}
                className={`flex-1 py-2.5 rounded-lg font-sans text-sm border transition-colors ${
                  Number(form.pump_id) === p.id ? 'bg-gold/10 border-gold/30 text-goldDim' : 'border-hairline text-muted hover:text-ivory'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
          <div className="font-sans text-[11px] text-mutedDim mt-1.5">
            {tank ? `Fuel: ${FUEL_LABEL[fuelType]} — from ${tank.name}` : 'This pump has no tank assigned yet.'}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="plate-label block mb-2">Opening Reading</label>
            <input
              type="number" step="0.1" value={form.opening_reading}
              onChange={(e) => setForm((f) => ({ ...f, opening_reading: e.target.value }))}
              className="w-full bg-obsidian border border-hairline rounded-lg px-4 py-3 font-sans text-sm text-ivory outline-none focus:border-gold/40"
            />
            <div className="font-sans text-[10px] text-mutedDim mt-1">Auto-filled from last shift's closing</div>
          </div>
          <div>
            <label className="plate-label block mb-2">Closing Reading</label>
            <input
              type="number" step="0.1" value={form.closing_reading}
              onChange={(e) => setForm((f) => ({ ...f, closing_reading: e.target.value }))}
              placeholder="0.0"
              className="w-full bg-obsidian border border-hairline rounded-lg px-4 py-3 font-sans text-lg text-ivory outline-none focus:border-gold/40"
            />
          </div>
        </div>
        {insufficientStock && (
          <div className="font-sans text-[11px] text-warn -mt-3">
            Warning: this exceeds current tank stock ({tank.current_liters.toLocaleString()} L left).
          </div>
        )}

        <div className="glass-panel p-4 flex justify-between items-center bg-obsidian">
          <span className="plate-label mb-0">{liters.toFixed(1)} L sold @ Rs {price.toFixed(2)}/L</span>
          <span className="font-display text-2xl text-goldDim font-bold">Rs {amount.toLocaleString('en-IN')}</span>
        </div>

        <div>
          <label className="plate-label block mb-2">Payment Split</label>
          <div className="grid grid-cols-2 gap-3">
            {[
              ['cash_amount', 'Cash'],
              ['card_amount', 'Card'],
              ['easypaisa_amount', 'Easypaisa'],
              ['jazzcash_amount', 'JazzCash'],
              ['credit_amount', 'Credit / Udhaar'],
            ].map(([key, label]) => (
              <div key={key}>
                <label className="font-sans text-[10px] text-mutedDim block mb-1">{label}</label>
                <input
                  type="number" value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder="0"
                  className="w-full bg-obsidian border border-hairline rounded-lg px-3 py-2 font-sans text-sm text-ivory outline-none focus:border-gold/40"
                />
              </div>
            ))}
          </div>
          {splitMismatch && (
            <div className="font-sans text-[11px] text-warn mt-2">
              Payment split (Rs {paymentSplitTotal.toLocaleString('en-IN')}) doesn't match total amount (Rs {amount.toLocaleString('en-IN')}).
            </div>
          )}
          {Number(form.credit_amount) > 0 && (
            <div className="mt-3 p-3.5 rounded-lg bg-obsidian border border-hairline">
              <label className="plate-label block mb-2">Which customer is this credit for?</label>
              {addingCustomer ? (
                <div className="flex gap-2">
                  <input
                    type="text" autoFocus value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    placeholder="Customer name"
                    className="flex-1 bg-panel border border-hairline rounded-lg px-3 py-2 font-sans text-sm text-ivory outline-none focus:border-gold/40"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!newCustomerName.trim()) return;
                      const saved = await addCreditCustomer({ name: newCustomerName.trim(), credit_limit: 0 });
                      setCreditCustomers((prev) => [...prev, saved]);
                      setForm((f) => ({ ...f, credit_customer_id: saved.id }));
                      setNewCustomerName('');
                      setAddingCustomer(false);
                    }}
                    className="font-sans text-[11px] text-emerald border border-emeraldLight/30 rounded-lg px-3 hover:bg-emeraldLight/10"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAddingCustomer(false); setNewCustomerName(''); }}
                    className="font-sans text-[11px] text-mutedDim hover:text-ivory"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <select
                    value={form.credit_customer_id}
                    onChange={(e) => setForm((f) => ({ ...f, credit_customer_id: e.target.value }))}
                    className="flex-1 bg-panel border border-hairline rounded-lg px-3 py-2 font-sans text-sm text-ivory outline-none focus:border-gold/40"
                  >
                    <option value="">Select customer…</option>
                    {creditCustomers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setAddingCustomer(true)}
                    className="font-sans text-[11px] text-goldDim border border-gold/30 rounded-lg px-3 hover:bg-gold/10 whitespace-nowrap"
                  >
                    + New
                  </button>
                </div>
              )}
              <div className="font-sans text-[10.5px] text-mutedDim mt-2">
                This will automatically add Rs {(Number(form.credit_amount) || 0).toLocaleString('en-IN')} to their Udhaar ledger when you log this shift.
              </div>
              {wouldExceedCreditLimit && (
                <div className="font-sans text-[11px] text-warn mt-2">
                  Warning: {selectedCreditCustomer.name}'s balance is already Rs {Math.round(selectedCustomerBalance).toLocaleString('en-IN')}.
                  Adding this will take them over their Rs {Number(selectedCreditCustomer.credit_limit).toLocaleString('en-IN')} credit limit.
                </div>
              )}
            </div>
          )}
        </div>

        {status && (
          <div className={`font-sans text-[12.5px] px-4 py-2.5 rounded-lg border flex items-center justify-between gap-3 ${
            status.type === 'success' ? 'border-emeraldLight/30 text-emerald bg-emeraldLight/5' : 'border-warnLight/30 text-warn bg-warnLight/5'
          }`}>
            <span>{status.msg}</span>
            {status.type === 'success' && lastSlip && (
              <button
                type="button"
                onClick={printSlip}
                className="shrink-0 font-sans text-[11px] font-medium text-white bg-gold rounded-lg px-3 py-1.5 hover:opacity-90 transition-opacity"
              >
                Print Slip
              </button>
            )}
          </div>
        )}

        <button
          type="submit" disabled={saving || !tank}
          className="w-full py-3 rounded-lg bg-gold text-white font-sans text-sm font-medium tracking-wide hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Log Shift'}
        </button>
      </form>
    </div>
  );
}
