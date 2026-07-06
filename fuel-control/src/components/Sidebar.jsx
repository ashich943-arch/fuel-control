const ICONS = {
  overview: 'M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6V11h-6v9Zm0-16v5h6V4h-6Z',
  shift: 'M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  inventory: 'M5 8h14l-1.5 11.5a2 2 0 0 1-2 1.5H8.5a2 2 0 0 1-2-1.5L5 8Zm2-4h10l1 4H6l1-4Z',
  prices: 'M4 12h16M4 6h16M4 18h10',
  expenses: 'M12 2v20m5-17H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  staff: 'M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 10v-2a4 4 0 0 0-3-3.87M14 3.13A4 4 0 0 1 14 10.87',
  credit: 'M17 9V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2m3 5h9a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-9a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2Zm4.5-5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z',
  reconciliation: 'M9 12l2 2 4-4m5 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  reports: 'M9 17V9m4 8V5m4 12v-5M4 19h16',
  activity: 'M3 12h4l2-8 4 16 3-8h5',
};

const NAV = [
  { id: 'overview', label: 'Overview' },
  { id: 'shift', label: 'Shift Entry' },
  { id: 'inventory', label: 'Tank Inventory' },
  { id: 'prices', label: 'Pricing', ownerOnly: true },
  { id: 'expenses', label: 'Expenses' },
  { id: 'staff', label: 'Staff', ownerOnly: true },
  { id: 'credit', label: 'Udhaar / Credit' },
  { id: 'reconciliation', label: 'Reconciliation' },
  { id: 'reports', label: 'Reports' },
  { id: 'activity', label: 'Activity Log', ownerOnly: true },
];

function NavIcon({ id, active }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-[18px] h-[18px] shrink-0"
      fill="none"
      stroke={active ? '#FFFFFF' : 'currentColor'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={ICONS[id]} />
    </svg>
  );
}

export default function Sidebar({ active, onNavigate, isOwner }) {
  const items = NAV.filter((item) => !item.ownerOnly || isOwner);
  return (
    <aside className="w-full md:w-56 shrink-0">
      <nav className="glass-panel p-3 flex md:flex-col gap-1.5 overflow-x-auto md:overflow-visible">
        {items.map((item) => {
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => !item.soon && onNavigate(item.id)}
              disabled={item.soon}
              className={
                'flex items-center gap-3 text-left px-3.5 py-2.5 rounded-xl font-sans text-[13.5px] font-medium whitespace-nowrap transition-colors ' +
                (isActive
                  ? 'bg-primary text-white shadow-primaryglow'
                  : item.soon
                  ? 'text-mutedDim cursor-not-allowed'
                  : 'text-muted hover:text-primaryDim hover:bg-primary/[0.06]')
              }
            >
              <NavIcon id={item.id} active={isActive} />
              {item.label}
              {item.soon && <span className="ml-auto text-[9.5px] text-mutedDim">soon</span>}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
