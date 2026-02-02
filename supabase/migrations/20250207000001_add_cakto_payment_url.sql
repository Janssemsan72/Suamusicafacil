-- ==========================================
-- Adicionar Coluna para Salvar URL de Pagamento Cakto
-- ==========================================
-- Esta migração adiciona uma coluna para salvar a URL de pagamento da Cakto
-- no pedido, permitindo reutilização da mesma URL para o mesmo pedido

-- Adicionar coluna cakto_payment_url
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cakto_payment_url TEXT;

-- Adicionar comentário descritivo
COMMENT ON COLUMN orders.cakto_payment_url IS 'URL de pagamento da Cakto gerada para este pedido. Permite reutilização da mesma URL quando o cliente retorna via WhatsApp.';

-- Verificar se a coluna foi criada
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'orders'
  AND column_name = 'cakto_payment_url';

