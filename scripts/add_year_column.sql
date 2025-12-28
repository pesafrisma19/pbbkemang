-- Add 'year' column to tax_objects table
ALTER TABLE "tax_objects" 
ADD COLUMN IF NOT EXISTS "year" smallint NOT NULL DEFAULT 2024;

COMMENT ON COLUMN "tax_objects"."year" IS 'Tahun Pajak SPPT';
