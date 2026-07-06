import { FUEL_LABEL, FUEL_TAG_CLASS } from '../lib/fuelTypes';

export default function ShiftsTable({ shifts, onDelete }) {
  return (
    <div className="glass-panel p-5">
      <div className="plate-label mb-3">Recent Shifts</div>
      <div className="overflow-x-auto">
      <table className="w-full border-collapse font-sans text-[12.5px]">
        <thead>
          <tr>
            {['Date', 'Shift', 'Staff', 'Pump', 'Fuel', 'Liters', 'Amount', ''].map((h) => (
              <th key={h} className="text-left text-[10px] tracking-[0.1em] uppercase text-muted font-medium pb-2.5 border-b border-hairline">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shifts.length === 0 && (
            <tr>
              <td colSpan={8} className="py-8 text-center text-mutedDim">
                No shifts logged yet — use Shift Entry to log opening/closing meter readings.
              </td>
            </tr>
          )}
          {shifts.map((s) => {
            const liters = Number(s.closing_reading) - Number(s.opening_reading);
            const amount = liters * Number(s.price_per_liter);
            return (
              <tr key={s.id} className="border-b border-hairline/50 last:border-none">
                <td className="py-2.5 text-ivory">{s.shift_date}</td>
                <td className="py-2.5 text-muted">{s.shift_type}</td>
                <td className="py-2.5 text-ivory">{s.staff?.name || '—'}</td>
                <td className="py-2.5 text-ivory">{s.pump}</td>
                <td className="py-2.5">
                  <span className={`px-2 py-0.5 rounded-full text-[10.5px] ${FUEL_TAG_CLASS[s.fuel_type]}`}>
                    {FUEL_LABEL[s.fuel_type]}
                  </span>
                </td>
                <td className="py-2.5 text-ivory">{liters.toFixed(1)} L</td>
                <td className="py-2.5 text-primaryDim font-semibold">Rs {amount.toLocaleString('en-IN')}</td>
                <td className="py-2.5 text-right">
                  {onDelete && (
                    <button onClick={() => onDelete(s)} className="font-sans text-[11px] text-mutedDim hover:text-warn" title="Delete">
                      ✕
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}
