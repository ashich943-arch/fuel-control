import { useEffect, useState } from 'react';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { STATION_NAME, AGENCY_NAME } from '../lib/config';

export default function TopBar({ onSignOut }) {
  const [time, setTime] = useState('');

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-GB'));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="flex justify-between items-center flex-wrap gap-4 pb-5 mb-6 border-b border-hairline">
      <div className="flex items-center gap-3.5">
        <img
          src="/logo.png"
          alt={`${STATION_NAME} logo`}
          className="w-11 h-11 object-contain"
        />
        <div>
          <div className="font-sans text-[10px] tracking-[0.18em] uppercase text-muted">
            {AGENCY_NAME}
          </div>
          <h1 className="font-display text-2xl text-ivory leading-tight">
            Fuel Control — {STATION_NAME}
          </h1>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right font-sans text-[12px] text-muted">
          <span>
            <span
              className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${
                isSupabaseConfigured ? 'bg-emeraldLight' : 'bg-warnLight'
              }`}
              style={{ boxShadow: `0 0 6px ${isSupabaseConfigured ? '#22C55E' : '#F5A623'}` }}
            />
            {isSupabaseConfigured ? 'Live database connected' : 'Demo mode — Supabase not connected'}
          </span>
          <span className="block text-lg text-goldLight font-semibold mt-0.5">{time}</span>
        </div>
        {onSignOut && (
          <button
            onClick={onSignOut}
            className="font-sans text-[11px] text-muted hover:text-warnLight border border-hairline hover:border-warnLight/30 rounded-lg px-3 py-2 transition-colors"
          >
            Sign out
          </button>
        )}
      </div>
    </div>
  );
}
