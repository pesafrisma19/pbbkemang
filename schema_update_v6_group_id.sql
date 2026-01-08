-- Add group_id column to citizens table
-- This is used to group family members together
ALTER TABLE citizens ADD COLUMN group_id VARCHAR;
