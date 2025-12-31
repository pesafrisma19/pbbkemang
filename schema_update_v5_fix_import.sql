-- Fix Import Error: "there is no unique or exclusion constraint matching the ON CONFLICT specification"
-- The import code uses .upsert() identifying rows by (nop, citizen_id).
-- This requires a Unique Index on those two columns combined.

DO $$
BEGIN
    -- 1. Ensure the old single-column unique constraint is gone (if not already)
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tax_objects_nop_key') THEN
        ALTER TABLE tax_objects DROP CONSTRAINT tax_objects_nop_key;
    END IF;

    -- 2. Add the composite unique constraint (NOP + Citizen)
    -- This allows multiple people to own the same NOP (Shared NOP),
    -- BUT prevents the SAME person from having the SAME NOP twice (duplicates).
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tax_objects_nop_citizen_unique') THEN
        ALTER TABLE tax_objects 
        ADD CONSTRAINT tax_objects_nop_citizen_unique UNIQUE (nop, citizen_id);
    END IF;
END $$;
