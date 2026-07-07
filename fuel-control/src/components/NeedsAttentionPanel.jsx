export default function NeedsAttentionPanel({ items }) {
  if (items.length === 0) return null;

  return (
    <div className="glass-panel p-4 mb-5 border-warn bg-warnLight/10">
      <div className="flex items-center gap-2.5 mb-2.5">
        <span className="w-2.5 h-2.5 rounded-full bg-warn shrink-0" style={{ boxShadow: '0 0 8px #D97706' }} />
        <span className="font-sans text-[13px] text-ivory font-semibold">Needs Attention ({items.length})</span>
      </div>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 flex-wrap">
            <span className="font-sans text-[12.5px] text-ivory/90">{item.text}</span>
            {item.actionLabel && (
              <button
                onClick={item.onAction}
                className="font-sans text-[11.5px] font-medium text-warn hover:opacity-80 shrink-0 underline decoration-dotted underline-offset-4"
              >
                {item.actionLabel} →
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
