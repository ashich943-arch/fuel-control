-- ============================================================
-- Nexivo Fuel Control — Phase 6: Pumps & Multiple Tanks per Fuel
-- Run this in your Supabase project: SQL Editor → New Query
-- ============================================================

-- Pumps are now real records, each wired to exactly one tank.
-- This lets you add a second tank for the same fuel type (e.g. two
-- petrol tanks) and assign each physical pump to the correct one.
create table if not exists pumps (
  id bigint generated always as identity primary key,
  name text not null,
  tank_id bigint references tanks(id) on delete set null,
  created_at timestamptz default now()
);

alter table pumps enable row level security;
create policy "Authenticated full access - pumps" on pumps
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Seed the 3 pumps you've been using, pointing at the first tank of
-- each matching fuel type. Adjust the mapping in the Tank Inventory
-- tab after running this if your pumps are wired differently.
insert into pumps (name, tank_id)
select 'P-1', (select id from tanks where fuel_type = 'petrol' order by id limit 1)
where not exists (select 1 from pumps where name = 'P-1');

insert into pumps (name, tank_id)
select 'P-2', (select id from tanks where fuel_type = 'diesel' order by id limit 1)
where not exists (select 1 from pumps where name = 'P-2');

insert into pumps (name, tank_id)
select 'P-3', (select id from tanks where fuel_type = 'hioctane' order by id limit 1)
where not exists (select 1 from pumps where name = 'P-3');
