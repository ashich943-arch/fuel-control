import { useEffect, useState } from 'react';
import { getActivityLog } from '../lib/api';
import { FUEL_LABEL } from '../lib/fuelTypes';

function describe(entry) {
  const { table_name, operation, old_data, new_data } = entry;
  const n = new_data || {};
  const o = old_data || {};

  switch (table_name) {
    case 'shifts': {
      const d = operation === 'DELETE' ? o : n;
      const liters = (Number(d.closing_reading) || 0) - (Number(d.opening_reading) || 0);
      return operation === 'DELETE'
        ? `deleted a shift — ${d.pump || '—'}, ${d.shift_type || ''}, ${d.shift_date || ''} (${liters.toFixed(1)} L)`
        : `logged a shift — ${d.pump || '—'}, ${d.shift_type || ''}, ${d.shift_date || ''} (${liters.toFixed(1)} L)`;
    }
    case 'fuel_prices':
      return `changed ${FUEL_LABEL[n.fuel_type] || n.fuel_type} price to Rs ${Number(n.price_per_liter).toFixed(2)}`;
    case 'staff': {
      if (operation === 'INSERT') return `added staff member "${n.name}"`;
      if (operation === 'DELETE') return `removed staff member "${o.name}"`;
      if (o.active === true && n.active === false) return `deactivated staff member "${n.name}"`;
      if (o.active === false && n.active === true) return `reactivated staff member "${n.name}"`;
      return `updated staff member "${n.name}"`;
    }
    case 'expenses': {
      const d = operation === 'DELETE' ? o : n;
      return operation === 'DELETE'
        ? `deleted an expense — Rs ${Number(d.amount).toLocaleString('en-IN')} (${d.category})`
        : `logged an expense — Rs ${Number(d.amount).toLocaleString('en-IN')} (${d.category})`;
    }
    case 'tank_deliveries': {
      const d = operation === 'DELETE' ? o : n;
      return operation === 'DELETE'
        ? `deleted a delivery — ${Number(d.liters).toLocaleString()} L`
        : `recorded a delivery — ${Number(d.liters).toLocaleString()} L from ${d.supplier || 'unnamed supplier'}`;
    }
    case 'daily_reconciliations':
      return `saved cash reconciliation for ${n.reconciliation_date || '—'}`;
    case 'credit_transactions': {
      const d = operation === 'DELETE' ? o : n;
      const label = d.type === 'payment' ? 'a payment' : 'a credit sale';
      return operation === 'DELETE'
        ? `deleted ${label} of Rs ${Number(d.amount).toLocaleString('en-IN')}`
        : `posted ${label} of Rs ${Number(d.amount).toLocaleString('en-IN')}`;
    }
    default:
      return `${operation.toLowerCase()} on ${table_name}`;
  }
}

export default function ActivityLog() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getActivityLog()
      .then(setEntries)
      .catch((err) => {
        console.error('Failed to load activity log:', err);
        setError('Could not load the activity log.');
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-5">
        <h2 className="font-display text-lg text-ivory uppercase tracking-wide font-bold">Activity Log</h2>
        <div className="flex-1 primary-divider" />
      </div>

      {loading ? (
        <div className="font-sans text-muted text-sm py-10 text-center">Loading…</div>
      ) : error ? (
        <div className="font-sans text-warn text-sm py-10 text-center">{error}</div>
      ) : entries.length === 0 ? (
        <div className="glass-panel p-8 text-center font-sans text-[13px] text-mutedDim">
          No activity recorded yet — this fills in as shifts, prices, staff changes, and other actions happen.
        </div>
      ) : (
        <div className="glass-panel p-5">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse font-sans text-[12.5px]">
              <thead>
                <tr>
                  {['When', 'Who', 'What'].map((h) => (
                    <th key={h} className="text-left text-[10px] tracking-[0.1em] uppercase text-muted font-medium pb-2.5 border-b border-hairline">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-hairline/50 last:border-none align-top">
                    <td className="py-2.5 text-muted whitespace-nowrap">
                      {new Date(e.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-2.5 text-ivory whitespace-nowrap">
                      {e.actor_name || e.actor_email || 'Unknown'}
                      {e.actor_role && <span className="text-mutedDim"> · {e.actor_role}</span>}
                    </td>
                    <td className={`py-2.5 ${e.operation === 'DELETE' ? 'text-warn' : 'text-ivory'}`}>{describe(e)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
