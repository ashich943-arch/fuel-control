import { useEffect, useState } from 'react';

export default function StatPlate({ label, value, prefix = '', suffix, trend, accent = false }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    // Handles negative values too (e.g. a real loss day on Net Profit) —
    // the old version forced a positive step, which meant a negative
    // target never counted down and just got stuck showing "1".
    if (!value) {
      setDisplay(0);
      return;
    }
    let cur = 0;
    const step = value / 40;
    const iv = setInterval(() => {
      cur += step;
      if ((step > 0 && cur >= value) || (step < 0 && cur <= value)) {
        cur = value;
        clearInterval(iv);
      }
      setDisplay(Math.round(cur));
    }, 20);
    return () => clearInterval(iv);
  }, [value]);

  const isNegative = display < 0;
  const formatted = `${isNegative ? '−' : ''}${prefix}${Math.abs(display).toLocaleString('en-IN')}${suffix || ''}`;

  if (accent) {
    return (
      <div className="glass-panel p-5 bg-gold border-gold shadow-goldglow">
        <div className="font-sans text-[10px] tracking-[0.1em] uppercase text-white/75">{label}</div>
        <div className="font-display text-3xl text-white mt-2 font-bold">
          {formatted}
        </div>
        {trend && (
          <div className="font-sans text-[11px] text-white/85 mt-2">
            <span>
              {trend.dir === 'up' ? '▲' : '▼'} {trend.value}
            </span>{' '}
            {trend.label}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="glass-panel p-5">
      <div className="plate-label">{label}</div>
      <div className={`font-display text-3xl mt-2 font-bold ${isNegative ? 'text-warn' : 'text-ivory'}`}>
        {formatted}
      </div>
      {trend && (
        <div className="font-sans text-[11px] text-muted mt-2">
          <span className={trend.dir === 'up' ? 'text-emeraldLight' : 'text-warnLight'}>
            {trend.dir === 'up' ? '▲' : '▼'} {trend.value}
          </span>{' '}
          {trend.label}
        </div>
      )}
    </div>
  );
}
