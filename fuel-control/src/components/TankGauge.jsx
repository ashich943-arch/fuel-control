export default function TankGauge({ name, liters, capacity }) {
  const rawPct = capacity > 0 ? (liters / capacity) * 100 : 0;
  const pct = Math.min(100, Math.max(0, Math.round(rawPct)));
  const isLow = pct < 45;
  const angle = -90 + (pct / 100) * 180; // -90deg to +90deg sweep
  const dash = 251.2;
  const offset = dash - (pct / 100) * dash;
  const color = isLow ? '#F5A623' : '#FF6B6B';

  return (
    <div className="glass-panel p-5 text-center">
      <svg viewBox="0 0 200 130" className="w-full max-w-[170px] mx-auto">
        <path
          d="M 20 110 A 80 80 0 0 1 180 110"
          fill="none"
          stroke="#EAEAEF"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d="M 20 110 A 80 80 0 0 1 180 110"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={dash}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.22,1,.36,1)' }}
          opacity="0.9"
        />
        <circle cx="100" cy="110" r="5" fill="#E5484D" />
        <line
          x1="100"
          y1="110"
          x2="100"
          y2="46"
          stroke="#374151"
          strokeWidth="2.5"
          strokeLinecap="round"
          style={{
            transformOrigin: '100px 110px',
            transform: `rotate(${angle}deg)`,
            transition: 'transform 1.4s cubic-bezier(.22,1,.36,1)',
          }}
        />
      </svg>
      <div className="font-display text-2xl mt-1" style={{ color }}>
        {pct}%
      </div>
      <div className="plate-label mt-1">{name}</div>
      <div className="font-sans text-[10.5px] text-mutedDim mt-1">
        {liters.toLocaleString()} / {capacity.toLocaleString()} L
        {isLow && <span className="text-warnLight"> — low</span>}
        {rawPct > 100 && <span className="text-warn"> — over capacity, check tank capacity setting</span>}
      </div>
    </div>
  );
}
