// Single source of truth for fuel types shown across the app (Shift
// Entry, Inventory, Credit, Reports, Shifts Table, Pricing). If a new
// client has different fuel types (e.g. adds CNG, drops Hi-Octane),
// this is the only file that needs updating on the frontend — plus
// the `fuel_type` check constraint on the `tanks`, `fuel_prices`,
// `shifts`, `credit_transactions`, and `suppliers` tables in Supabase.

export const FUEL_TYPES = ['petrol', 'diesel', 'hioctane'];

export const FUEL_LABEL = {
  petrol: 'Petrol',
  diesel: 'Diesel',
  hioctane: 'Hi-Octane',
};

export const FUEL_OPTIONS = FUEL_TYPES.map((id) => ({ id, label: FUEL_LABEL[id] }));

// Tailwind classes for the small colored pill/tag used next to a fuel
// type in tables (Shifts Table, Reports).
export const FUEL_TAG_CLASS = {
  petrol: 'bg-primary/15 text-primaryLight',
  diesel: 'bg-emeraldLight/15 text-emeraldLight',
  hioctane: 'bg-warn/15 text-warnLight',
};
