-- ==========================================
-- Remover dados do Cakto de um pedido específico
-- ==========================================
-- Remove Cakto Order ID e Referência do Provedor
-- ID: c0ce9806-97f4-4ae5-b10d-6964c68afa8a
-- ==========================================

-- Remover dados do Cakto do pedido
UPDATE orders
SET 
  provider_ref = NULL,
  cakto_transaction_id = NULL,
  cakto_payment_status = NULL,
  provider = CASE 
    WHEN provider = 'cakto' THEN NULL 
    ELSE provider 
  END,
  updated_at = NOW()
WHERE 
  id = 'c0ce9806-97f4-4ae5-b10d-6964c68afa8a'
  OR provider_ref = 'c0ce9806-97f4-4ae5-b10d-6964c68afa8a'
  OR cakto_transaction_id = 'c0ce9806-97f4-4ae5-b10d-6964c68afa8a';

