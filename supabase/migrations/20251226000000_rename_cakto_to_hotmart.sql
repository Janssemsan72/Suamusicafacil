-- Rename columns in orders table
ALTER TABLE orders RENAME COLUMN cakto_payment_status TO hotmart_payment_status;
ALTER TABLE orders RENAME COLUMN cakto_transaction_id TO hotmart_transaction_id;

-- Check if cakto_payment_url exists before renaming
DO $$
BEGIN
  IF EXISTS(SELECT *
    FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'cakto_payment_url')
  THEN
      ALTER TABLE "orders" RENAME COLUMN "cakto_payment_url" TO "hotmart_payment_url";
  END IF;
END $$;

-- Rename payment_provider enum value
ALTER TYPE payment_provider RENAME VALUE 'cakto' TO 'hotmart';

-- Rename cakto_webhooks table if it exists
DO $$
BEGIN
  IF EXISTS(SELECT *
    FROM information_schema.tables
    WHERE table_name = 'cakto_webhooks')
  THEN
      ALTER TABLE "cakto_webhooks" RENAME TO "hotmart_webhooks";
  END IF;
END $$;
