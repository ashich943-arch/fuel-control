import { useEffect, useState } from 'react';
import { getAllStaff, addStaff, updateStaff, setStaffActive, getSalaryPayments, addSalaryPayment } from '../lib/api';
import { localDateString } from '../lib/date';

export default function Staff() {
  const [staff, setStaff] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [staffForm, setStaffForm] = useState({ name: '', cnic: '', phone: '', role: 'Attendant', monthly_salary: '', commission_per_liter: '' });
  const [editingId, setEditingId] = useState(null);
  const [payForm, setPayForm] = useState({ staff_id: '', amount: '', type: 'salary', note: '' });
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);

  const activeStaff = staff.filter((s) => s.active);

  useEffect(() => {
    load();
  }, []);

  function load() {
    setLoading(true);
    Promise.all([getAllStaff(), getSalaryPayments()])
      .then(([s, p]) => {
        setStaff(s);
        setPayments(p);
        setPayForm((f) => ({ ...f, staff_id: f.staff_id || s.find((x) => x.active)?.id || '' }));
      })
      .catch((err) => {
        console.error('Failed to load staff data:', err);
        setStatus({ type: 'error', msg: 'Could not load staff data. Refresh and try again.' });
      })
      .finally(() => setLoading(false));
  }

  function startEdit(s) {
    setEditingId(s.id);
    setStaffForm({
      name: s.name,
      cnic: s.cnic || '',
      phone: s.phone || '',
      role: s.role,
      monthly_salary: String(s.monthly_salary),
      commission_per_liter: String(s.commission_per_liter || 0),
    });
    setStatus(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setStaffForm({ name: '', cnic: '', phone: '', role: 'Attendant', monthly_salary: '', commission_per_liter: '' });
  }

  async function handleSaveStaff(e) {
    e.preventDefault();
    if (!staffForm.name) {
      setStatus({ type: 'error', msg: 'Enter staff name.' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: staffForm.name,
        cnic: staffForm.cnic,
        phone: staffForm.phone,
        role: staffForm.role,
        monthly_salary: Number(staffForm.monthly_salary) || 0,
        commission_per_liter: Number(staffForm.commission_per_liter) || 0,
      };
      if (editingId) {
        await updateStaff(editingId, payload);
        setStatus({ type: 'success', msg: `${staffForm.name} updated.` });
      } else {
        await addStaff(payload);
        setStatus({ type: 'success', msg: `${staffForm.name} added.` });
      }
      cancelEdit();
      load();
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', msg: editingId ? 'Could not update staff.' : 'Could not add staff.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(s) {
    const goingInactive = s.active;
    if (goingInactive && !window.confirm(`Mark ${s.name} as inactive? They'll disappear from the Shift Entry and Payment dropdowns, but their history stays intact.`)) return;
    try {
      await setStaffActive(s.id, !s.active);
      load();
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', msg: 'Could not update staff status.' });
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
        <div className="flex-1 primary-divider" />
      </div>

      <div className="glass-panel p-5 mb-6">
        {staff.length === 0 ? (
          <div className="font-sans text-mutedDim text-sm py-4 text-center">No staff added yet.</div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full border-collapse font-sans text-[12.5px]">
            <thead>
              <tr>
                {['Name', 'Role', 'Phone', 'Monthly Salary', 'Commission/L', 'Status', ''].map((h) => (
                  <th key={h} className="text-left text-[10px] tracking-[0.1em] uppercase text-muted font-medium pb-2.5 border-b border-hairline">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id} className={`border-b border-hairline/50 last:border-none ${!s.active ? 'opacity-50' : ''}`}>
                  <td className="py-2.5 text-ivory">{s.name}</td>
                  <td className="py-2.5 text-muted">{s.role}</td>
                  <td className="py-2.5 text-muted">{s.phone || '—'}</td>
                  <td className="py-2.5 text-primaryLight font-semibold">
                    Rs {Number(s.monthly_salary).toLocaleString('en-IN')}
                  </td>
                  <td className="py-2.5 text-muted">
                    {Number(s.commission_per_liter) > 0 ? `Rs ${Number(s.commission_per_liter).toFixed(2)}` : '—'}
                  </td>
                  <td className="py-2.5">
                    <span className={`text-[10.5px] px-2 py-0.5 rounded-full ${s.active ? 'bg-emeraldLight/15 text-emeraldLight' : 'bg-mutedDim/15 text-mutedDim'}`}>
                      {s.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-2.5 text-right whitespace-nowrap">
                    <button onClick={() => startEdit(s)} className="font-sans text-[11px] text-muted hover:text-ivory mr-3">
                      Edit
                    </button>
                    <button onClick={() => handleToggleActive(s)} className="font-sans text-[11px] text-mutedDim hover:text-warn">
                      {s.active ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        <form onSubmit={handleSaveStaff} className="glass-panel p-6 flex flex-col gap-4 h-fit">
          <div className="plate-label">{editingId ? 'Edit Staff Member' : 'Add Staff Member'}</div>
          <input
            type="text" placeholder="Full name" value={staffForm.name}
            onChange={(e) => setStaffForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full bg-obsidian border border-hairline rounded-lg px-4 py-2.5 font-sans text-sm text-ivory outline-none focus:border-primary/40"
          />
          <input
            type="text" placeholder="CNIC (optional)" value={staffForm.cnic}
            onChange={(e) => setStaffForm((f) => ({ ...f, cnic: e.target.value }))}
            className="w-full bg-obsidian border border-hairline rounded-lg px-4 py-2.5 font-sans text-sm text-ivory outline-none focus:border-primary/40"
          />
          <input
            type="text" placeholder="Phone" value={staffForm.phone}
            onChange={(e) => setStaffForm((f) => ({ ...f, phone: e.target.value }))}
            className="w-full bg-obsidian border border-hairline rounded-lg px-4 py-2.5 font-sans text-sm text-ivory outline-none focus:border-primary/40"
          />
          <select
            value={staffForm.role}
            onChange={(e) => setStaffForm((f) => ({ ...f, role: e.target.value }))}
            className="w-full bg-obsidian border border-hairline rounded-lg px-4 py-2.5 font-sans text-sm text-ivory outline-none focus:border-primary/40"
          >
            <option>Attendant</option>
            <option>Cashier</option>
            <option>Manager</option>
          </select>
          <input
            type="number" placeholder="Monthly salary (Rs)" value={staffForm.monthly_salary}
            onChange={(e) => setStaffForm((f) => ({ ...f, monthly_salary: e.target.value }))}
            className="w-full bg-obsidian border border-hairline rounded-lg px-4 py-2.5 font-sans text-sm text-ivory outline-none focus:border-primary/40"
          />
          <div>
            <input
              type="number" step="0.01" placeholder="Commission per liter (Rs, optional)" value={staffForm.commission_per_liter}
              onChange={(e) => setStaffForm((f) => ({ ...f, commission_per_liter: e.target.value }))}
              className="w-full bg-obsidian border border-hairline rounded-lg px-4 py-2.5 font-sans text-sm text-ivory outline-none focus:border-primary/40"
            />
            <div className="font-sans text-[10.5px] text-mutedDim mt-1.5">
              Leave 0 if this staff member doesn't earn commission. Shown per-shift in Reports.
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-lg bg-primary text-white font-sans text-sm font-medium tracking-wide hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {editingId ? 'Update Staff' : 'Add Staff'}
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

        <form onSubmit={handlePayment} className="glass-panel p-6 flex flex-col gap-4 h-fit">
          <div className="plate-label">Salary / Advance Payment</div>
          <select
            value={payForm.staff_id}
            onChange={(e) => setPayForm((f) => ({ ...f, staff_id: e.target.value }))}
            className="w-full bg-obsidian border border-hairline rounded-lg px-4 py-2.5 font-sans text-sm text-ivory outline-none focus:border-primary/40"
          >
            {activeStaff.length === 0 && <option value="">No active staff</option>}
            {activeStaff.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <div className="flex gap-2">
            {['salary', 'advance', 'deduction'].map((t) => (
              <button
                type="button" key={t}
                onClick={() => setPayForm((f) => ({ ...f, type: t }))}
                className={`flex-1 py-2 rounded-lg font-sans text-xs capitalize border transition-colors ${
                  payForm.type === t ? 'bg-primary/10 border-primary/30 text-primaryLight' : 'border-hairline text-muted hover:text-ivory'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <input
            type="number" placeholder="Amount (Rs)" value={payForm.amount}
            onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))}
            className="w-full bg-obsidian border border-hairline rounded-lg px-4 py-2.5 font-sans text-sm text-ivory outline-none focus:border-primary/40"
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
        <div className="flex-1 primary-divider" />
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
                  <td className="py-2.5 text-primaryLight font-semibold">Rs {Number(p.amount).toLocaleString('en-IN')}</td>
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
