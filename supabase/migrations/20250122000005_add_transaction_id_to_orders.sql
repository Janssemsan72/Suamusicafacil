-- ==========================================
-- Adicionar transaction_id à tabela orders
-- ==========================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS transaction_id TEXT;

