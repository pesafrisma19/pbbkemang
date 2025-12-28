-- RUN THIS IN SUPABASE SQL EDITOR

-- 1. Create Admins Table
CREATE TABLE admins (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    phone text NOT NULL UNIQUE,
    password text NOT NULL, -- Note: For production, we should hash passwords!
    created_at timestamptz DEFAULT now()
);

-- 2. Insert the Default Admin (from previous request)
INSERT INTO admins (phone, password)
VALUES ('085220581369', 'admin123');

-- 3. Enable RLS (Optional but good practice)
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- 4. Policy: Allow anyone to read (for login check) or restrict to service role
-- For simple login form without Auth Auth, we need public read or a server function.
-- To keep it simple for this Client-Side app:
CREATE POLICY "Enable read access for all users" ON admins FOR SELECT USING (true);
