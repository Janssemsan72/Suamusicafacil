-- ==========================================
-- Adicionar coluna magic_token à tabela orders
-- ==========================================
-- Token usado para links de download e validação de acesso ao pedido (ex.: SongDownload, get-order-by-token).
-- ==========================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS magic_token TEXT;

COMMENT ON COLUMN orders.magic_token IS 'Token único para links de download e acesso público ao pedido (ex.: /download/:songId/:token).';
