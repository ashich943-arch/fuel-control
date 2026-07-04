import { useEffect, useState } from 'react';
import { getStaff, addStaff, getSalaryPayments, addSalaryPayment } from '../lib/api';
import { localDateString } from '../lib/date';

export default function Staff() {
  const [staff, setStaff] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [staffForm, setStaffForm] = useState({ name: '', cnic: '', phone: '', role: 'Attendant', monthly_salary: '' });
  const [payForm, setPayForm] = useState({ staff_id: '', amount: '', type: 'salary', note: '' });
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  function load() {
    setLoading(true);
    Promise.all([getStaff(), getSalaryPayments()])
      .then(([s, p]) => {
        setStaff(s);
        setPayments(p);
        setPayForm((f) => ({ ...f, staff_id: f.staff_id || s[0]?.id || '' }));
      })
      .catch((err) => {
        console.error('Failed to load staff data:', err);
        setStatus({ type: 'error', msg: 'Could not load staff data. Refresh and try again.' });
      })
      .finally(() => setLoading(false));
  }

  async function handleAddStaff(e) {
    e.preventDefault();
    if (!staffForm.name) {
      setStatus({ type: 'error', msg: 'Enter staff name.' });
      return;
    }
    setSaving(true);
    try {
      await addStaff({
        name: staffForm.name,
        cnic: staffForm.cnic,
        phone: staffForm.phone,
        role: staffForm.role,
        monthly_salary: Number(staffForm.monthly_salary) || 0,
      });
      setStatus({ type: 'success', msg: `${staffForm.name} added.` });
      setStaffForm({ name: '', cnic: '', phone: '', role: 'Attendant', monthly_salary: '' });
      load();
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', msg: 'Could not add staff.' });
    } finally {
      setSaving(false);
    }
  }

  async function handlePayment(e) {
    e.preventDefault();
    if (!payForm.amount || !payForm.staff_id) {
      setStatus({ type: 'error', msg: 'Select staff and enter amount.' });
      return;
    }
    setSaving(true);
    try {
      await addSalaryPayment({
        staff_id: Number(payForm.staff_id),
        amount: Number(payForm.amount),
        type: payForm.type,
        note: payForm.note,
        paid_at: localDateString(),
      });
      setStatus({ type: 'success', msg: `Recorded ${payForm.type} of Rs ${Number(payForm.amount).toLocaleString('en-IN')}.` });
      setPayForm((f) => ({ ...f, amount: '', note: '' }));
      load();
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', msg: 'Could not record payment.' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="font-sans text-muted text-sm py-10 text-center">Loading staff…</div>;

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-3.5">
        <h2 className="font-display text-lg text-ivory uppercase tracking-wide font-bold">Staff</h2>
        <div className="flex-1 gold-divider" />
      </div>

      <div className="glass-panel p-5 mb-6">
        {staff.length === 0 ? (
          <div className="font-sans text-mutedDim text-sm py-4 text-center">No staff added yet.</div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full border-collapse font-sans text-[12.5px]">
            <thead>
              <tr>
                {['Name', 'Role', 'Phone', 'Monthly Salary'].map((h) => (
                  <th key={h} className="text-left text-[10px] tracking-[0.1em] uppercase text-muted font-medium pb-2.5 border-b border-hairline">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id} className="border-b border-hairline/50 last:border-none">
                  <td className="py-2.5 text-ivory">{s.name}</td>
                  <td className="py-2.5 text-muted">{s.role}</td>
                  <td className="py-2.5 text-muted">{s.phone || '—'}</td>
                  <td className="py-2.5 text-goldLight font-semibold">
                    Rs {Number(s.monthly_salary).toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        <form onSubmit={handleAddStaff} className="glass-panel p-6 flex flex-col gap-4 h-fit">
          <div className="plate-label">Add Staff Member</div>
          <input
            type="text" placeholder="Full name" value={staffForm.name}
            onChange={(e) => setStaffForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full bg-obsidian border border-hairline rounded-lg px-4 py-2.5 font-sans text-sm text-ivory outline-none focus:border-gold/40"
          />
          <input
            type="text" placeholder="CNIC (optional)" value={staffForm.cnic}
            onChange={(e) => setStaffForm((f) => ({ ...f, cnic: e.target.value }))}
            className="w-full bg-obsidian border border-hairline rounded-lg px-4 py-2.5 font-sans text-sm text-ivory outline-none focus:border-gold/40"
          />
          <input
            type="text" placeholder="Phone" value={staffForm.phone}
            onChange={(e) => setStaffForm((f) => ({ ...f, phone: e.target.value }))}
            className="w-full bg-obsidian border border-hairline rounded-lg px-4 py-2.5 font-sans text-sm text-ivory outline-none focus:border-gold/40"
          />
          <select
            value={staffForm.role}
            onChange={(e) => setStaffForm((f) => ({ ...f, role: e.target.value }))}
            className="w-full bg-obsidian border border-hairline rounded-lg px-4 py-2.5 font-sans text-sm text-ivory outline-none focus:border-gold/40"
          >
            <option>Attendant</option>
            <option>Cashier</option>
            <option>Manager</option>
          </select>
          <input
            type="number" placeholder="Monthly salary (Rs)" value={staffForm.monthly_salary}
            onChange={(e) => setStaffForm((f) => ({ ...f, monthly_salary: e.target.value }))}
            className="w-full bg-obsidian border border-hairline rounded-lg px-4 py-2.5 font-sans text-sm text-ivory outline-none focus:border-gold/40"
          />
          <button
            type="submit" disabled={saving}
            className="w-full py-2.5 rounded-lg bg-gold text-white font-sans text-sm font-medium tracking-wide hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            Add Staff
          </button>
        </form>

        <form onSubmit={handlePayment} className="glass-panel p-6 flex flex-col gap-4 h-fit">
          <div className="plate-label">Salary / Advance Payment</div>
          <select
            value={payForm.staff_id}
            onChange={(e) => setPayForm((f) => ({ ...f, staff_id: e.target.value }))}
            className="w-full bg-obsidian border border-hairline rounded-lg px-4 py-2.5 font-sans text-sm text-ivory outline-none focus:border-gold/40"
          >
            {staff.length === 0 && <option value="">No staff added yet</option>}
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <div className="flex gap-2">
            {['salary', 'advance', 'deduction'].map((t) => (
              <button
                type="button" key={t}
                onClick={() => setPayForm((f) => ({ ...f, type: t }))}
                className={`flex-1 py-2 rounded-lg font-sans text-xs capitalize border transition-colors ${
                  payForm.type === t ? 'bg-gold/10 border-gold/30 text-goldLight' : 'border-hairline text-muted hover:text-ivory'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <input
            type="number" placeholder="Amount (Rs)" value={payForm.amount}
            onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))}
            className="w-full bg-obsidian border border-hairline rounded-lg px-4 py-2.5 font-sans text-sm text-ivory outline-none focus:border-gold/40"
          />
          <input
            type="text" placeholder="Note (optional)" value={payForm.note}
            onChange={(e) => setPayForm((f) => ({ ...f, note: e.target.value }))}
            className="w-full bg-obsidian border border-hairline rounded-lg px-4 py-2.5 font-sans text-sm text-ivory outline-none focus:border-gold/40"
          />
          <button
            type="submit" disabled={saving}
            className="w-full py-2.5 rounded-lg bg-gold text-white font-sans text-sm font-medium tracking-wide hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            Record Payment
          </button>
        </form>
      </div>

      {status && (
        <div className={`font-sans text-[12.5px] px-4 py-2.5 rounded-lg border mb-6 max-w-xl ${
          status.type === 'success' ? 'border-emeraldLight/30 text-emeraldLight bg-emeraldLight/5' : 'border-warnLight/30 text-warnLight bg-warnLight/5'
        }`}>
          {status.msg}
        </div>
      )}

      <div className="flex items-center gap-2.5 mb-3.5">
        <h2 className="font-display text-lg text-ivory uppercase tracking-wide font-bold">Payment History</h2>
        <div className="flex-1 gold-divider" />
      </div>
      <div className="glass-panel p-5">
        {payments.length === 0 ? (
          <div className="font-sans text-mutedDim text-sm py-4 text-center">No payments recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full border-collapse font-sans text-[12.5px]">
            <thead>
              <tr>
                {['Date', 'Staff', 'Type', 'Note', 'Amount'].map((h) => (
                  <th key={h} className="text-left text-[10px] tracking-[0.1em] uppercase text-muted font-medium pb-2.5 border-b border-hairline">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-hairline/50 last:border-none">
                  <td className="py-2.5 text-ivory">{p.paid_at}</td>
                  <td className="py-2.5 text-ivory">{p.staff?.name || '—'}</td>
                  <td className="py-2.5 text-muted capitalize">{p.type}</td>
                  <td className="py-2.5 text-muted">{p.note || '—'}</td>
                  <td className="py-2.5 text-goldLight font-semibold">Rs {Number(p.amount).toLocaleString('en-IN')}</td>
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
