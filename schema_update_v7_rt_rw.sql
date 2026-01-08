-- Add RT and RW columns to citizens table
-- This allows for better structuring of address data

ALTER TABLE citizens ADD COLUMN rt VARCHAR;
ALTER TABLE citizens ADD COLUMN rw VARCHAR;
