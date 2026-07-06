import { useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { STATION_NAME } from '../lib/config';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    onLogin(data.session);
  }

  async function handleForgotPassword() {
    if (!email) {
      setError('Enter your email above first, then tap "Forgot password?" again.');
      return;
    }
    setResetting(true);
    setError('');
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setResetting(false);
    if (error) {
      setError(error.message);
      return;
    }
    setResetSent(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-5">
      <div className="glass-panel p-8 w-full max-w-sm">
        <div className="flex items-center gap-3 mb-6">
          <img
            src="/logo.png"
            alt={`${STATION_NAME} logo`}
            className="w-10 h-10 object-contain"
          />
          <div>
            <div className="font-sans text-[10px] tracking-[0.18em] uppercase text-muted">
              Nexivo Fuel Control
            </div>
            <div className="font-display text-lg text-ivory">Admin Sign In</div>
          </div>
        </div>

        {!isSupabaseConfigured && (
          <div className="font-sans text-[12px] text-warn border border-warnLight/30 bg-warnLight/5 rounded-lg px-4 py-2.5 mb-4">
            Supabase not configured. Add your credentials to .env to enable login.
          </div>
        )}

        {resetSent ? (
          <div className="font-sans text-[13px] text-emerald border border-emeraldLight/30 bg-emeraldLight/5 rounded-lg px-4 py-3">
            Password reset link sent to {email}. Check your inbox, then come back and sign in with your new password.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="plate-label block mb-2">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-obsidian border border-hairline rounded-lg px-4 py-3 font-sans text-sm text-ivory outline-none focus:border-primary/40"
                placeholder="owner@station.com"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="plate-label mb-0">Password</label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={resetting}
                  className="font-sans text-[11px] text-muted hover:text-primaryDim underline decoration-dotted underline-offset-4 disabled:opacity-50"
                >
                  {resetting ? 'Sending…' : 'Forgot password?'}
                </button>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-obsidian border border-hairline rounded-lg px-4 py-3 font-sans text-sm text-ivory outline-none focus:border-primary/40"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="font-sans text-[12px] text-warn border border-warnLight/30 bg-warnLight/5 rounded-lg px-4 py-2.5">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !isSupabaseConfigured}
              className="w-full py-3 rounded-lg bg-primary text-white font-sans text-sm font-medium tracking-wide hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
