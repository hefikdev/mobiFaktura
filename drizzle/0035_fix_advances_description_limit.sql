-- Migration: Fix advances description character limit
-- Increase advances.description from varchar(1000) to varchar(2000) to match Zod validation

ALTER TABLE zaliczki ALTER COLUMN description TYPE VARCHAR(2000);
