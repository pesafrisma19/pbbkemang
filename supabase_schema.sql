-- Create table for Wajib Pajak (WP) / Residents
create table citizens (
  id uuid default gen_random_uuid() primary key,
  nik varchar unique,
  name varchar not null,
  address text,
  phone varchar,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create table for Tax Objects (NOP / Kikitir)
create table tax_objects (
  id uuid default gen_random_uuid() primary key,
  nop varchar unique not null,
  citizen_id uuid references citizens(id) on delete cascade not null,
  location_name varchar not null, -- e.g. "Sawah Blok A", "Rumah Tinggal"
  year integer not null,
  amount_due decimal(12,2) not null, -- Tagihan
  status varchar check (status in ('unpaid', 'paid')) default 'unpaid',
  paid_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table citizens enable row level security;
alter table tax_objects enable row level security;

-- Create policies (Allow public read for transparency, allow authenticated insert/update)
-- Note: In a real app, you might want to restrict public read to only specific fields via a view or API
create policy "Public read access" on citizens for select using (true);
create policy "Public read access" on tax_objects for select using (true);

create policy "Admin full access citizens" on citizens for all using (auth.role() = 'authenticated');
create policy "Admin full access tax_objects" on tax_objects for all using (auth.role() = 'authenticated');

-- Insert dummy data for demonstration
insert into citizens (id, name, address, nik) values 
  ('d0b3c2a1-1234-4567-8901-abcdef123456', 'Bp. Asep Saepudin', 'Dusun 1, Blok Sawah', '3201123456780001'),
  ('a1b2c3d4-5678-9012-3456-abcdef654321', 'Ibu Siti Aminah', 'Dusun 2, Perumahan', '3201123456780002');

insert into tax_objects (nop, citizen_id, location_name, year, amount_due, status) values
  ('32.04.100.001.005-0123.0', 'd0b3c2a1-1234-4567-8901-abcdef123456', 'Sawah Blok A', 2024, 150000, 'unpaid'),
  ('32.04.100.001.005-0124.0', 'd0b3c2a1-1234-4567-8901-abcdef123456', 'Rumah Tinggal', 2024, 50000, 'unpaid'),
  ('32.04.100.001.005-0099.0', 'a1b2c3d4-5678-9012-3456-abcdef654321', 'Rumah Tinggal', 2024, 85000, 'paid');
