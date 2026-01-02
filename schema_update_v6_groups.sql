-- Create table for Groups
create table citizen_groups (
  id uuid default gen_random_uuid() primary key,
  name varchar unique not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add group_id to citizens
alter table citizens 
add column group_id uuid references citizen_groups(id) on delete set null;

-- Enable Row Level Security (RLS)
alter table citizen_groups enable row level security;

-- Policies
create policy "Public read access" on citizen_groups for select using (true);
create policy "Admin full access citizen_groups" on citizen_groups for all using (auth.role() = 'authenticated');
