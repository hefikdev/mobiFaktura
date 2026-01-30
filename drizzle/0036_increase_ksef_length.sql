-- Increase ksef_number column length to 300 to support longer KSeF identifiers
ALTER TABLE "invoices" ALTER COLUMN "ksef_number" TYPE varchar(300);
