-- ==========================================
-- CORREÇÃO: Permitir marcação manual de pedidos como pagos
-- ==========================================
-- Este trigger permite que pedidos sejam marcados manualmente como pagos
-- (via admin ou scripts SQL), mas mantém validação automática para webhooks
-- ==========================================

-- Função do trigger que marca automaticamente pedidos Cakto como pagos
-- ✅ CORREÇÃO: Permite marcação manual E automática
CREATE OR REPLACE FUNCTION trigger_auto_mark_cakto_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verificar se é um pedido Cakto
  IF (NEW.provider = 'cakto' OR NEW.payment_provider = 'cakto') THEN
    
    -- ✅ CENÁRIO 1: Marcação manual (status mudou diretamente para 'paid')
    -- Se o status mudou de 'pending' para 'paid' diretamente (sem mudança em cakto_payment_status),
    -- permitir a marcação manual (feita pelo admin ou scripts SQL)
    IF OLD.status = 'pending' 
       AND NEW.status = 'paid'
       AND OLD.status != NEW.status
       AND (OLD.cakto_payment_status IS NULL 
            OR OLD.cakto_payment_status = NEW.cakto_payment_status) THEN
      -- Permitir marcação manual - apenas garantir que paid_at está definido
      NEW.paid_at := COALESCE(NEW.paid_at, NEW.created_at);
      NEW.updated_at := NOW();
      
      RAISE NOTICE '✅ [Trigger Auto Mark] Pedido % marcado manualmente como pago (marcação manual permitida)', NEW.id;
      RETURN NEW;
    END IF;
    
    -- ✅ CENÁRIO 2: Marcação automática via webhook (cakto_payment_status mudou)
    -- Só marcar automaticamente se tiver cakto_transaction_id válido
    IF NEW.status = 'pending' 
       AND NEW.cakto_payment_status IN ('approved', 'paid', 'pago', 'aprovada')
       AND (OLD.cakto_payment_status IS NULL 
            OR OLD.cakto_payment_status NOT IN ('approved', 'paid', 'pago', 'aprovada'))
       AND NEW.cakto_transaction_id IS NOT NULL 
       AND NEW.cakto_transaction_id != '' 
       AND TRIM(NEW.cakto_transaction_id) != ''
       AND LENGTH(TRIM(NEW.cakto_transaction_id)) >= 6 THEN -- IDs da Cakto têm pelo menos 6 caracteres
      
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
               OR TRIM(NEW.cakto_transaction_id) = ''
               OR LENGTH(TRIM(NEW.cakto_transaction_id)) < 6) THEN
      -- ⚠️ AVISO: Não marcar automaticamente se não tiver transaction_id válido
      -- Mas não impedir marcação manual posterior
      RAISE WARNING '⚠️ [Trigger Auto Mark] Pedido % NÃO será marcado automaticamente - falta cakto_transaction_id válido (cakto_payment_status: %, transaction_id: %). Pode ser marcado manualmente.', 
        NEW.id, NEW.cakto_payment_status, COALESCE(NEW.cakto_transaction_id, 'NULL');
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Atualizar trigger para ser acionado em qualquer UPDATE
DROP TRIGGER IF EXISTS trigger_auto_mark_cakto_paid ON orders;
CREATE TRIGGER trigger_auto_mark_cakto_paid
  BEFORE UPDATE ON orders
  FOR EACH ROW
  WHEN (
    (NEW.provider = 'cakto' OR NEW.payment_provider = 'cakto')
    AND (
      -- Acionar para marcação manual (status mudou para paid)
      (OLD.status = 'pending' AND NEW.status = 'paid')
      OR
      -- Acionar para marcação automática (cakto_payment_status mudou)
      (NEW.status = 'pending'
       AND NEW.cakto_payment_status IN ('approved', 'paid', 'pago', 'aprovada')
       AND (OLD.cakto_payment_status IS NULL 
            OR OLD.cakto_payment_status NOT IN ('approved', 'paid', 'pago', 'aprovada')))
    )
  )
  EXECUTE FUNCTION trigger_auto_mark_cakto_paid();

-- Comentários
COMMENT ON FUNCTION trigger_auto_mark_cakto_paid() IS 
'Função do trigger que permite marcação manual de pedidos Cakto como pagos (via admin ou scripts SQL) e marca automaticamente quando cakto_payment_status muda para approved/paid/pago E tem cakto_transaction_id válido (mínimo 6 caracteres).';

COMMENT ON TRIGGER trigger_auto_mark_cakto_paid ON orders IS 
'Trigger BEFORE UPDATE que permite marcação manual de pedidos Cakto como pagos e marca automaticamente quando cakto_payment_status muda para approved/paid/pago E tem cakto_transaction_id válido (mínimo 6 caracteres).';

