-- ==========================================
-- Adicionar coluna provider_ref à tabela orders
-- ==========================================
-- Referência do provedor de pagamento (ex.: Cakto/Hotmart).
-- Usada por AdminOrderDetails e por 20251117000004_remove_cakto_data_from_order.
-- ==========================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS provider_ref TEXT;

COMMENT ON COLUMN orders.provider_ref IS 'Referência do provedor de pagamento (ex.: ID do pedido no Cakto/Hotmart).';
