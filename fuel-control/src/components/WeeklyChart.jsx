export default function WeeklyChart({ weekly }) {
  const hasData = weekly && weekly.length > 0 && weekly.some((w) => w.liters > 0);
  const max = hasData ? Math.max(...weekly.map((w) => w.liters)) : 1;

  return (
    <div className="glass-panel p-5">
      <div className="plate-label mb-4">Weekly Throughput (Liters)</div>
      {!hasData ? (
        <div className="h-[150px] flex items-center justify-center font-sans text-mutedDim text-sm text-center px-4">
          No sales logged yet this week — this chart fills in as you log sales.
        </div>
      ) : (
        <div className="flex items-end gap-3 h-[150px] px-1">
          {weekly.map((w, i) => {
            const h = Math.max(4, Math.round((w.liters / max) * 100));
            const isWeekend = w.day === 'Sat' || w.day === 'Sun';
            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-end gap-2 h-full">
                <div
                  className={
                    'w-full max-w-[30px] rounded-t-[4px] rounded-b-[2px] ' +
                    (isWeekend
                      ? 'bg-gradient-to-b from-emeraldLight to-emerald shadow-[0_0_10px_rgba(74,156,130,0.18)]'
                      : 'bg-gradient-to-b from-primaryLight to-primary shadow-primaryglow')
                  }
                  style={{ height: `${h}%`, transition: 'height 1s cubic-bezier(.22,1,.36,1)' }}
                />
                <div className="font-sans text-[10px] text-muted">{w.day}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
