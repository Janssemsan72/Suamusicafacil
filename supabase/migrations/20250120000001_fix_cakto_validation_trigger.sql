-- ==========================================
-- Corrigir Trigger de Validação Cakto
-- ==========================================
-- Atualizar validate_cakto_order() para aceitar:
-- - cakto_transaction_id preenchido, OU
-- - cakto_payment_status = 'approved'/'paid'/'pago'
-- ==========================================

-- Função de validação corrigida
CREATE OR REPLACE FUNCTION validate_cakto_order()
RETURNS TRIGGER AS $$
BEGIN
  -- Se é um pedido Cakto (provider = 'cakto' ou payment_provider = 'cakto')
  IF (NEW.provider = 'cakto' OR NEW.payment_provider = 'cakto') THEN
    -- ✅ CORREÇÃO: Se está marcado como pago, deve ter cakto_transaction_id OU cakto_payment_status = 'approved'
    IF NEW.status = 'paid' THEN
      -- Permitir se tiver cakto_transaction_id
      IF NEW.cakto_transaction_id IS NOT NULL AND NEW.cakto_transaction_id != '' THEN
        -- OK, tem transaction_id
        NULL;
      -- ✅ NOVO: Permitir se tiver cakto_payment_status = 'approved'/'paid'/'pago'
      ELSIF NEW.cakto_payment_status IN ('approved', 'paid', 'pago', 'aprovada') THEN
        -- OK, tem status aprovado
        NULL;
      ELSE
        -- Não tem nem transaction_id nem status aprovado
        RAISE EXCEPTION 'Pedidos Cakto marcados como pagos devem ter cakto_transaction_id preenchido OU cakto_payment_status = approved. Order ID: %', NEW.id;
      END IF;
    END IF;
    
    -- Se tem cakto_transaction_id, verificar se já existe (exceto para o próprio registro em UPDATE)
    IF NEW.cakto_transaction_id IS NOT NULL AND NEW.cakto_transaction_id != '' THEN
      IF TG_OP = 'INSERT' THEN
        IF EXISTS (
          SELECT 1 FROM orders 
          WHERE cakto_transaction_id = NEW.cakto_transaction_id
        ) THEN
          RAISE EXCEPTION 'cakto_transaction_id % já existe no banco. Possível duplicação de webhook.', NEW.cakto_transaction_id;
        END IF;
      ELSIF TG_OP = 'UPDATE' THEN
        IF EXISTS (
          SELECT 1 FROM orders 
          WHERE cakto_transaction_id = NEW.cakto_transaction_id
          AND id != NEW.id
        ) THEN
          RAISE EXCEPTION 'cakto_transaction_id % já existe em outro pedido. Possível duplicação.', NEW.cakto_transaction_id;
        END IF;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Comentário atualizado
COMMENT ON FUNCTION validate_cakto_order() IS 
'Valida que pedidos Cakto têm cakto_transaction_id OU cakto_payment_status = approved quando pagos e previne duplicações';

