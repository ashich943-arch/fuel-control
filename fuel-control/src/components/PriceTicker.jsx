export default function PriceTicker({ prices, tanks }) {
  const lowTank = tanks.find((t) => (t.current_liters / t.capacity_liters) * 100 < (t.low_stock_threshold_pct ?? 25));

  const items = [
    ...prices.map((p) => ({
      label: p.fuel_type === 'hioctane' ? 'Hi-Octane' : p.fuel_type[0].toUpperCase() + p.fuel_type.slice(1),
      value: `Rs ${Number(p.price_per_liter).toFixed(2)}`,
      dir: 'up',
    })),
    ...(lowTank
      ? [{ label: `${lowTank.name}`, value: `below ${lowTank.low_stock_threshold_pct ?? 25}% — reorder soon`, dir: null }]
      : []),
  ];

  const track = [...items, ...items];

  return (
    <div className="glass-panel overflow-hidden mb-6 relative bg-gold border-gold shadow-goldglow">
      <div className="absolute inset-y-0 left-0 w-9 bg-gradient-to-r from-gold to-transparent z-10" />
      <div className="absolute inset-y-0 right-0 w-9 bg-gradient-to-l from-gold to-transparent z-10" />
      <div className="inline-flex gap-12 py-2.5 px-6 whitespace-nowrap animate-[scroll_24s_linear_infinite] font-sans text-[13px]">
        {track.map((it, i) => (
          <span key={i} className="text-white/75">
            {it.label}{' '}
            <b className="font-semibold text-white">
              {it.dir === 'up' ? '▲ ' : it.dir === 'down' ? '▼ ' : '— '}
              {it.value}
            </b>
          </span>
        ))}
      </div>
    </div>
  );
}
