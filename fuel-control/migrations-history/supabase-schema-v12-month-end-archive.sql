-- ============================================================
-- Nexivo Fuel Control — v12: Month-End Archive
-- Run this in Supabase SQL Editor → New Query.
--
-- What this adds:
-- archived_periods — a permanent record that a given date range was
-- "closed" by the owner, with a locked-in snapshot of that period's
-- totals (sales, expenses, profit, etc.) at the time it was closed.
--
-- IMPORTANT: this does NOT delete or move any shifts, expenses,
-- deliveries, or other data. Nothing in this app ever hard-deletes
-- financial history. "Archiving" a period just creates a permanent,
-- owner-only receipt confirming that period was reviewed and closed
-- — the underlying data stays exactly where it is and remains fully
-- visible in Reports by picking that date range. This is deliberate:
-- deleting real business records to "start fresh" risks losing data
-- you can't get back (tax records, disputes, audits).
-- ============================================================

create table if not exists archived_periods (
  id bigint generated always as identity primary key,
  period_label text not null,
  period_start date not null,
  period_end date not null,
  totals_snapshot jsonb not null,
  archived_by_name text,
  archived_at timestamptz default now()
);

alter table archived_periods enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'archived_periods' and policyname = 'Owner full access - archived_periods') then
    create policy "Owner full access - archived_periods" on archived_periods
      for all using (is_owner()) with check (is_owner());
  end if;
end $$;

drop trigger if exists trg_log_archived_periods on archived_periods;
create trigger trg_log_archived_periods after insert on archived_periods
  for each row execute function log_activity();
