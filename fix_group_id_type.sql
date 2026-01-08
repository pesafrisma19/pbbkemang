-- Fix group_id column type
-- The error "invalid input syntax for type uuid" suggests this column was created as UUID.
-- We need it to be VARCHAR to accept simple numbers like '1', '2', '5'.

ALTER TABLE citizens ALTER COLUMN group_id TYPE VARCHAR;
