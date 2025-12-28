-- Copy and Run this in your Supabase SQL Editor

-- 1. Add WhatsApp column to citizens table
ALTER TABLE citizens 
ADD COLUMN whatsapp text;

-- 2. Add Paid Timestamp column to tax_objects table
ALTER TABLE tax_objects 
ADD COLUMN paid_at timestamptz;
