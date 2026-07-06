import { useEffect, useState } from 'react';
import TopBar from './components/TopBar';
import Sidebar from './components/Sidebar';
import Login from './components/Login';
import Overview from './pages/Overview';
import ShiftEntry from './pages/ShiftEntry';
import Inventory from './pages/Inventory';
import Pricing from './pages/Pricing';
import Expenses from './pages/Expenses';
import Staff from './pages/Staff';
import Reports from './pages/Reports';
import Credit from './pages/Credit';
import Reconciliation from './pages/Reconciliation';
import ActivityLog from './pages/ActivityLog';
import Suppliers from './pages/Suppliers';
import { supabase, isSupabaseConfigured } from './lib/supabaseClient';
import { getMyProfile } from './lib/api';
import { STATION_NAME } from './lib/config';

function RestrictedNotice() {
  return (
    <div className="glass-panel p-8 text-center font-sans text-[13px] text-mutedDim">
      This section is only available to the station owner.
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState('overview');
  const [session, setSession] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(isSupabaseConfigured);
  const [profile, setProfile] = useState(null);
  const [profileChecked, setProfileChecked] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCheckingAuth(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const userId = session?.user?.id || null;

  useEffect(() => {
    // Reset immediately when the actual logged-in user changes (not
    // on every token refresh, which creates a new session object for
    // the same user every ~50 min) — so a previous login's role can
    // never briefly, or permanently if the new fetch fails, carry
    // over to a different login on the same browser.
    setProfile(null);
    setProfileChecked(false);

    if (!userId && isSupabaseConfigured) return;

    let cancelled = false;
    getMyProfile()
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch((err) => console.error('Failed to load profile:', err))
      .finally(() => {
        if (!cancelled) setProfileChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (isSupabaseConfigured && checkingAuth) {
    return <div className="min-h-screen flex items-center justify-center font-sans text-muted text-sm">Checking session…</div>;
  }
  if (isSupabaseConfigured && !session) {
    return <Login onLogin={setSession} />;
  }

  // No user_profiles row yet for this login — most likely the owner
  // hasn't run the one-time setup step from migration v10. Default to
  // manager-level access (least privilege) rather than silently
  // granting owner access, but say so clearly instead of just hiding
  // things with no explanation.
  const isOwner = profile?.role === 'owner';
  const showNoRoleBanner = profileChecked && isSupabaseConfigured && !profile;

  return (
    <div className="max-w-[1600px] mx-auto px-6 md:px-8 py-7">
      <TopBar onSignOut={isSupabaseConfigured ? () => supabase.auth.signOut() : null} role={profile?.role} />
      {showNoRoleBanner && (
        <div className="mb-5 px-4 py-3 rounded-lg border border-warnLight/30 bg-warnLight/10 font-sans text-[12.5px] text-warn">
          No role is set up for this login yet, so you're seeing manager-level access only. Run the one-time step at the bottom of{' '}
          <code className="font-mono text-[11.5px]">supabase-schema-v10-roles-and-activity-log.sql</code> to assign yourself as owner.
        </div>
      )}
      <div className="flex flex-col md:flex-row gap-5">
        <Sidebar active={page} onNavigate={setPage} isOwner={isOwner} />
        <main className="flex-1 min-w-0">
          {page === 'overview' && <Overview onNavigate={setPage} isOwner={isOwner} />}
          {page === 'shift' && <ShiftEntry />}
          {page === 'inventory' && <Inventory />}
          {page === 'suppliers' && <Suppliers />}
          {page === 'prices' && (isOwner ? <Pricing /> : <RestrictedNotice />)}
          {page === 'expenses' && <Expenses />}
          {page === 'staff' && (isOwner ? <Staff /> : <RestrictedNotice />)}
          {page === 'credit' && <Credit />}
          {page === 'reconciliation' && <Reconciliation />}
          {page === 'reports' && <Reports isOwner={isOwner} />}
          {page === 'activity' && (isOwner ? <ActivityLog /> : <RestrictedNotice />)}
        </main>
      </div>
      <footer className="mt-8 flex justify-between flex-wrap gap-2 font-sans text-[10.5px] text-mutedDim">
        <span>Nexivo Fuel Control · {STATION_NAME}</span>
        <span>Supabase-ready · Owner &amp; Manager roles</span>
      </footer>
    </div>
  );
}
