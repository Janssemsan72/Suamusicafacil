-- ==========================================
-- Trigger de validação para pedidos Cakto
-- ==========================================
--
-- Objetivo: Validar que pedidos Cakto têm cakto_transaction_id quando status = 'paid'
-- e prevenir duplicações antes mesmo de tentar inserir

-- Função de validação
CREATE OR REPLACE FUNCTION validate_cakto_order()
RETURNS TRIGGER AS $$
BEGIN
  -- Se é um pedido Cakto (provider = 'cakto' ou payment_provider = 'cakto')
  IF (NEW.provider = 'cakto' OR NEW.payment_provider = 'cakto') THEN
    -- Se está marcado como pago, deve ter cakto_transaction_id
    IF NEW.status = 'paid' AND (NEW.cakto_transaction_id IS NULL OR NEW.cakto_transaction_id = '') THEN
      RAISE EXCEPTION 'Pedidos Cakto marcados como pagos devem ter cakto_transaction_id preenchido. Order ID: %', NEW.id;
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

-- Criar trigger BEFORE INSERT/UPDATE
DROP TRIGGER IF EXISTS trigger_validate_cakto_order ON orders;
CREATE TRIGGER trigger_validate_cakto_order
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION validate_cakto_order();

-- Adicionar comentário
COMMENT ON FUNCTION validate_cakto_order() IS 
'Valida que pedidos Cakto têm cakto_transaction_id quando pagos e previne duplicações';

