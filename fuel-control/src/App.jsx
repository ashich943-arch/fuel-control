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
import { supabase, isSupabaseConfigured } from './lib/supabaseClient';

export default function App() {
  const [page, setPage] = useState('overview');
  const [session, setSession] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(isSupabaseConfigured);

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

  if (isSupabaseConfigured && checkingAuth) {
    return <div className="min-h-screen flex items-center justify-center font-sans text-muted text-sm">Checking session…</div>;
  }
  if (isSupabaseConfigured && !session) {
    return <Login onLogin={setSession} />;
  }

  return (
    <div className="max-w-[1600px] mx-auto px-6 md:px-8 py-7">
      <TopBar onSignOut={isSupabaseConfigured ? () => supabase.auth.signOut() : null} />
      <div className="flex flex-col md:flex-row gap-5">
        <Sidebar active={page} onNavigate={setPage} />
        <main className="flex-1 min-w-0">
          {page === 'overview' && <Overview onNavigate={setPage} />}
          {page === 'shift' && <ShiftEntry />}
          {page === 'inventory' && <Inventory />}
          {page === 'prices' && <Pricing />}
          {page === 'expenses' && <Expenses />}
          {page === 'staff' && <Staff />}
          {page === 'credit' && <Credit />}
          {page === 'reconciliation' && <Reconciliation />}
          {page === 'reports' && <Reports />}
        </main>
      </div>
      <footer className="mt-8 flex justify-between flex-wrap gap-2 font-sans text-[10.5px] text-mutedDim">
        <span>Nexivo Fuel Control · Cheema Fuel Station</span>
        <span>Single-admin build · Supabase-ready</span>
      </footer>
    </div>
  );
}
