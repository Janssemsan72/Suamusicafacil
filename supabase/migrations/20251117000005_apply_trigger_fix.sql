-- ==========================================
-- Aplicar correção do trigger - Requer Transaction ID
-- ==========================================
-- Este trigger só marca como pago se tiver transaction_id válido
-- Garante que pedidos só sejam marcados como pagos quando realmente pagos
-- ==========================================

-- Função do trigger que marca automaticamente pedidos Cakto como pagos
-- ✅ CORREÇÃO: Só marca como pago se tiver cakto_transaction_id válido
-- Isso garante que só marca quando recebe confirmação real do webhook da Cakto
CREATE OR REPLACE FUNCTION trigger_auto_mark_cakto_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verificar se é um pedido Cakto
  IF (NEW.provider = 'cakto' OR NEW.payment_provider = 'cakto') THEN
    -- ✅ VALIDAÇÃO CRÍTICA: Só marcar como pago se:
    -- 1. Status está pending
    -- 2. cakto_payment_status mudou para approved/paid/pago
    -- 3. TEM cakto_transaction_id válido (não nulo e não vazio)
    -- Isso garante que só marca quando recebe confirmação real do provedor via webhook
    IF NEW.status = 'pending' 
       AND NEW.cakto_payment_status IN ('approved', 'paid', 'pago', 'aprovada')
       AND (OLD.cakto_payment_status IS NULL 
            OR OLD.cakto_payment_status NOT IN ('approved', 'paid', 'pago', 'aprovada'))
       AND NEW.cakto_transaction_id IS NOT NULL 
       AND NEW.cakto_transaction_id != '' 
       AND TRIM(NEW.cakto_transaction_id) != '' THEN
      
      -- Marcar como pago automaticamente
      NEW.status := 'paid';
      NEW.paid_at := COALESCE(NEW.paid_at, NEW.created_at);
      NEW.updated_at := NOW();
      
      RAISE NOTICE '✅ [Trigger Auto Mark] Pedido % marcado automaticamente como pago (cakto_payment_status: %, transaction_id: %)', 
        NEW.id, NEW.cakto_payment_status, NEW.cakto_transaction_id;
    ELSIF NEW.status = 'pending' 
          AND NEW.cakto_payment_status IN ('approved', 'paid', 'pago', 'aprovada')
          AND (OLD.cakto_payment_status IS NULL 
               OR OLD.cakto_payment_status NOT IN ('approved', 'paid', 'pago', 'aprovada'))
          AND (NEW.cakto_transaction_id IS NULL 
               OR NEW.cakto_transaction_id = '' 
               OR TRIM(NEW.cakto_transaction_id) = '') THEN
      -- ⚠️ AVISO: Não marcar como pago se não tiver transaction_id
      RAISE WARNING '⚠️ [Trigger Auto Mark] Pedido % NÃO será marcado como pago - falta cakto_transaction_id válido (cakto_payment_status: %)', 
        NEW.id, NEW.cakto_payment_status;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Atualizar trigger
DROP TRIGGER IF EXISTS trigger_auto_mark_cakto_paid ON orders;
CREATE TRIGGER trigger_auto_mark_cakto_paid
  BEFORE UPDATE ON orders
  FOR EACH ROW
  WHEN (
    (NEW.provider = 'cakto' OR NEW.payment_provider = 'cakto')
    AND NEW.status = 'pending'
    AND NEW.cakto_payment_status IN ('approved', 'paid', 'pago', 'aprovada')
    AND (OLD.cakto_payment_status IS NULL 
         OR OLD.cakto_payment_status NOT IN ('approved', 'paid', 'pago', 'aprovada'))
  )
  EXECUTE FUNCTION trigger_auto_mark_cakto_paid();

-- Comentários
COMMENT ON FUNCTION trigger_auto_mark_cakto_paid() IS 
'Função do trigger que marca automaticamente pedidos Cakto como pagos quando cakto_payment_status muda para approved/paid/pago E tem cakto_transaction_id válido. Garante que pedidos só sejam marcados como pagos quando realmente pagos via webhook.';

COMMENT ON TRIGGER trigger_auto_mark_cakto_paid ON orders IS 
'Trigger BEFORE UPDATE que marca automaticamente pedidos Cakto como pagos quando cakto_payment_status muda para approved/paid/pago E tem cakto_transaction_id válido.';

