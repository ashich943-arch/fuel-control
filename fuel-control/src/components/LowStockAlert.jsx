export default function LowStockAlert({ tanks, onGoToInventory }) {
  const lowTanks = tanks.filter(
    (t) => (t.current_liters / t.capacity_liters) * 100 < (t.low_stock_threshold_pct ?? 25)
  );
  if (lowTanks.length === 0) return null;

  return (
    <div className="glass-panel p-4 mb-5 border-warn bg-warnLight/10 flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-center gap-3">
        <span className="w-2.5 h-2.5 rounded-full bg-warn shrink-0" style={{ boxShadow: '0 0 8px #D97706' }} />
        <span className="font-sans text-[13px] text-ivory">
          <b className="font-semibold">Low stock:</b>{' '}
          {lowTanks.map((t, i) => (
            <span key={t.id}>
              {t.name} at {Math.round((t.current_liters / t.capacity_liters) * 100)}%
              {i < lowTanks.length - 1 ? ', ' : ''}
            </span>
          ))}
          {' '}— order fuel soon to avoid running out.
        </span>
      </div>
      <button
        onClick={onGoToInventory}
        className="font-sans text-[12px] font-medium text-white bg-warn rounded-lg px-3.5 py-2 hover:opacity-90 transition-opacity shrink-0"
      >
        Record Delivery
      </button>
    </div>
  );
}
