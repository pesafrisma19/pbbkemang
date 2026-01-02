-- 1. Create table for Groups (Safe if exists)
create table if not exists citizen_groups (
  id uuid default gen_random_uuid() primary key,
  name varchar unique not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Add group_id to citizens (Safe if exists)
do $$
begin
    if not exists (select 1 from information_schema.columns where table_name = 'citizens' and column_name = 'group_id') then
        alter table citizens add column group_id uuid references citizen_groups(id) on delete set null;
    end if;
end $$;

-- 3. Enable RLS (Safe to re-run)
alter table citizen_groups enable row level security;

-- 4. Re-create Policies (Drop first to update)
drop policy if exists "Public read access" on citizen_groups;
create policy "Public read access" on citizen_groups for select using (true);

drop policy if exists "Admin full access citizen_groups" on citizen_groups;
create policy "Admin full access citizen_groups" on citizen_groups for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
