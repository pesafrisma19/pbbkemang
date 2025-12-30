-- Remove UNIQUE constraint from nop column in tax_objects
-- This allows multiple Wajib Pajak to share the same NOP (e.g. inheritance, shared land)

-- Attempt to drop the constraint safely
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tax_objects_nop_key') THEN
        ALTER TABLE tax_objects DROP CONSTRAINT tax_objects_nop_key;
    END IF;
END $$;

-- If the unique constraint was created as a unique index automatically without a specific name
-- We might need to drop the index.
DROP INDEX IF EXISTS tax_objects_nop_key;
