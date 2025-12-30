-- 3. Add new columns to tax_objects table for better data coverage
ALTER TABLE tax_objects 
ADD COLUMN original_name text, -- Nama Asal/Sebelumnya (Old Owner Name)
ADD COLUMN persil text,        -- Nomor Persil
ADD COLUMN blok text;          -- Blok/Sektor
