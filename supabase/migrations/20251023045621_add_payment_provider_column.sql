-- Add payment_provider column to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS payment_provider VARCHAR(20) DEFAULT 'stripe',
ADD COLUMN IF NOT EXISTS cakto_transaction_id TEXT,
ADD COLUMN IF NOT EXISTS cakto_payment_status TEXT;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_cakto_transaction ON orders(cakto_transaction_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_provider ON orders(payment_provider);

-- Add comments for documentation
COMMENT ON COLUMN orders.payment_provider IS 'Payment provider used: stripe or cakto';
COMMENT ON COLUMN orders.cakto_transaction_id IS 'Cakto transaction ID for Brazilian payments';
COMMENT ON COLUMN orders.cakto_payment_status IS 'Cakto payment status: approved, pending, or cancelled';
