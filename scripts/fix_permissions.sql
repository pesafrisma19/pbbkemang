-- FIX PERMISSIONS (ALLOW APP TO WRITE DATA)
-- Since we use custom Admin Login, we need to allow the 'anon' role to modify data.
-- (The application protects these actions via the Admin Dashboard pages)

-- 1. CITIZENS TABLE
ALTER TABLE citizens ENABLE ROW LEVEL SECURITY;

-- Drop existing restrictive policies if any
DROP POLICY IF EXISTS "Public read access" ON citizens;
DROP POLICY IF EXISTS "Admin full access citizens" ON citizens;
DROP POLICY IF EXISTS "Allow Anon Full Access" ON citizens;

-- Create new permissive policy
CREATE POLICY "Allow Anon Full Access" ON citizens
FOR ALL
USING (true)
WITH CHECK (true);

-- 2. TAX_OBJECTS TABLE
ALTER TABLE tax_objects ENABLE ROW LEVEL SECURITY;

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Public read access" ON tax_objects;
DROP POLICY IF EXISTS "Admin full access tax_objects" ON tax_objects;
DROP POLICY IF EXISTS "Allow Anon Full Access" ON tax_objects;

-- Create new permissive policy
CREATE POLICY "Allow Anon Full Access" ON tax_objects
FOR ALL
USING (true)
WITH CHECK (true);

-- 3. Verify IDs (Optional Fix for Import)
-- Ensure IDs are generated automatically if not provided
ALTER TABLE citizens ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE tax_objects ALTER COLUMN id SET DEFAULT gen_random_uuid();
