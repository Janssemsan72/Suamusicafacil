-- ==========================================
-- SISTEMA DE VALIDAÇÃO SEGURA DE PAGAMENTOS CAKTO
-- ==========================================
-- Este script implementa validação robusta para garantir que apenas
-- pedidos com webhook válido processado ou marcação manual auditada
-- sejam marcados como pagos, evitando erros de marcação incorreta.
-- ==========================================

-- ==============================
-- PARTE 1: FUNÇÃO DE MARCAÇÃO MANUAL AUDITADA
-- ==============================

CREATE OR REPLACE FUNCTION mark_order_as_paid_manual(
  p_order_id UUID,
  p_reason TEXT,
  p_evidence JSONB DEFAULT NULL,
  p_admin_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_has_webhook BOOLEAN;
  v_webhook_id UUID;
BEGIN
  -- Buscar pedido
  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado: %', p_order_id;
  END IF;
  
  -- Verificar se já está pago
  IF v_order.status = 'paid' THEN
    RAISE EXCEPTION 'Pedido já está marcado como pago';
  END IF;
  
  -- Verificar se tem webhook válido
  SELECT EXISTS(
    SELECT 1 FROM cakto_webhooks
    WHERE order_id = p_order_id
    AND processed = true
    AND status = 'approved'
  ) INTO v_has_webhook;
  
  -- Se tem webhook válido, não permitir marcação manual
  IF v_has_webhook THEN
    RAISE EXCEPTION 'Pedido já tem webhook válido processado. Use o webhook para marcar como pago.';
  END IF;
  
  -- Registrar log ANTES de marcar
  INSERT INTO admin_logs (
    action,
    target_table,
    target_id,
    changes
  ) VALUES (
    'mark_order_paid_manual',
    'orders',
    p_order_id,
    jsonb_build_object(
      'reason', p_reason,
      'evidence', COALESCE(p_evidence, '{}'::jsonb),
      'previous_status', v_order.status,
      'new_status', 'paid',
      'has_webhook', v_has_webhook,
      'customer_email', v_order.customer_email,
      'manual_mark', true,
      'admin_user_id', p_admin_user_id,
      'timestamp', NOW()
    )
  );
  
  -- Marcar como pago
  UPDATE orders
  SET 
    status = 'paid',
    paid_at = COALESCE(paid_at, created_at),
    updated_at = NOW(),
    -- Flag especial para indicar marcação manual
    cakto_webhook_metadata = COALESCE(cakto_webhook_metadata, '{}'::jsonb) || 
      jsonb_build_object(
        'manual_mark', true, 
        'manual_mark_reason', p_reason,
        'manual_mark_at', NOW(),
        'manual_mark_by', p_admin_user_id
      )
  WHERE id = p_order_id;
  
  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION mark_order_as_paid_manual IS 
'Função para marcar pedido como pago manualmente com auditoria completa. 
Valida que não existe webhook válido antes de permitir marcação manual.
Registra ação no admin_logs para rastreabilidade.';

-- ==============================
-- PARTE 2: TRIGGER DE VALIDAÇÃO ROBUSTA
-- ==============================

CREATE OR REPLACE FUNCTION trigger_validate_cakto_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_valid_webhook BOOLEAN;
  v_has_manual_mark BOOLEAN;
  v_webhook_count INTEGER;
  v_cutoff_date TIMESTAMPTZ := '2025-01-25 00:00:00'::timestamptz; -- Data de implementação
BEGIN
  -- Apenas validar pedidos Cakto
  IF NOT (NEW.provider = 'cakto' OR NEW.payment_provider = 'cakto') THEN
    RETURN NEW;
  END IF;
  
  -- Se não está mudando para 'paid', não validar
  IF NEW.status != 'paid' OR (OLD.status = 'paid' AND NEW.status = 'paid') THEN
    RETURN NEW;
  END IF;
  
  -- PEDIDOS ANTIGOS: Permitir sem validação (compatibilidade)
  IF NEW.created_at < v_cutoff_date THEN
    RAISE NOTICE '✅ [Validação] Pedido antigo (antes de %) - permitindo marcação', v_cutoff_date;
    RETURN NEW;
  END IF;
  
  -- PEDIDOS NOVOS: Validar rigorosamente
  
  -- Verificar se tem webhook válido processado
  SELECT COUNT(*)
  INTO v_webhook_count
  FROM cakto_webhooks
  WHERE order_id = NEW.id
  AND processed = true
  AND status = 'approved'
  AND transaction_id IS NOT NULL
  AND LENGTH(TRIM(transaction_id)) >= 6;
  
  -- Buscar webhook_id se existir
  IF v_webhook_count > 0 THEN
    SELECT id INTO NEW.cakto_webhook_id
    FROM cakto_webhooks
    WHERE order_id = NEW.id
    AND processed = true
    AND status = 'approved'
    ORDER BY processed_at DESC
    LIMIT 1;
  END IF;
  
  v_has_valid_webhook := (v_webhook_count > 0);
  
  -- Verificar se foi marcado manualmente (via função específica)
  v_has_manual_mark := (
    NEW.cakto_webhook_metadata IS NOT NULL
    AND NEW.cakto_webhook_metadata->>'manual_mark' = 'true'
  );
  
  -- VALIDAÇÃO: Deve ter webhook válido OU marcação manual
  IF NOT v_has_valid_webhook AND NOT v_has_manual_mark THEN
    RAISE EXCEPTION 'Pedido Cakto não pode ser marcado como pago sem webhook válido ou marcação manual auditada. 
      Order ID: %, 
      Has Webhook: %, 
      Has Manual Mark: %, 
      Transaction ID: %,
      Created At: %',
      NEW.id, v_has_valid_webhook, v_has_manual_mark, NEW.cakto_transaction_id, NEW.created_at;
  END IF;
  
  -- Se tem webhook válido, garantir que cakto_webhook_id está preenchido
  IF v_has_valid_webhook AND NEW.cakto_webhook_id IS NULL THEN
    SELECT id INTO NEW.cakto_webhook_id
    FROM cakto_webhooks
    WHERE order_id = NEW.id
    AND processed = true
    AND status = 'approved'
    ORDER BY processed_at DESC
    LIMIT 1;
  END IF;
  
  RAISE NOTICE '✅ [Validação] Pedido % validado: Webhook=% Manual=%', 
    NEW.id, v_has_valid_webhook, v_has_manual_mark;
  
  RETURN NEW;
END;
$$;

-- Criar trigger BEFORE UPDATE
DROP TRIGGER IF EXISTS trigger_validate_cakto_payment ON orders;
CREATE TRIGGER trigger_validate_cakto_payment
  BEFORE UPDATE ON orders
  FOR EACH ROW
  WHEN (
    (NEW.provider = 'cakto' OR NEW.payment_provider = 'cakto')
    AND NEW.status = 'paid'
    AND (OLD.status IS NULL OR OLD.status != 'paid')
  )
  EXECUTE FUNCTION trigger_validate_cakto_payment();

COMMENT ON FUNCTION trigger_validate_cakto_payment() IS 
'Trigger que valida se pedido Cakto pode ser marcado como pago.
Para novos pedidos (após 2025-01-25), exige webhook válido OU marcação manual auditada.
Para pedidos antigos, permite marcação sem validação (compatibilidade).';

COMMENT ON TRIGGER trigger_validate_cakto_payment ON orders IS 
'Valida marcação de pagamentos Cakto antes de permitir UPDATE para status paid.';

-- ==============================
-- PARTE 3: ATUALIZAR TRIGGER DE MARCAÇÃO AUTOMÁTICA
-- ==============================

CREATE OR REPLACE FUNCTION trigger_auto_mark_cakto_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_valid_webhook BOOLEAN;
  v_webhook_id UUID;
BEGIN
  IF (NEW.provider = 'cakto' OR NEW.payment_provider = 'cakto') THEN
    
    -- CENÁRIO 1: Marcação automática via webhook
    IF NEW.status = 'pending' 
       AND NEW.cakto_payment_status IN ('approved', 'paid', 'pago', 'aprovada')
       AND (OLD.cakto_payment_status IS NULL 
            OR OLD.cakto_payment_status NOT IN ('approved', 'paid', 'pago', 'aprovada'))
       AND NEW.cakto_transaction_id IS NOT NULL 
       AND LENGTH(TRIM(NEW.cakto_transaction_id)) >= 6 THEN
      
      -- Verificar se existe webhook válido processado
      SELECT EXISTS(
        SELECT 1 FROM cakto_webhooks
        WHERE transaction_id = NEW.cakto_transaction_id
        AND processed = true
        AND status = 'approved'
        AND order_id = NEW.id
      ), (
        SELECT id FROM cakto_webhooks
        WHERE transaction_id = NEW.cakto_transaction_id
        AND processed = true
        AND status = 'approved'
        AND order_id = NEW.id
        ORDER BY processed_at DESC
        LIMIT 1
      ) INTO v_has_valid_webhook, v_webhook_id;
      
      IF v_has_valid_webhook THEN
        NEW.status := 'paid';
        NEW.paid_at := COALESCE(NEW.paid_at, NEW.created_at);
        NEW.cakto_webhook_id := v_webhook_id;
        NEW.updated_at := NOW();
        
        RAISE NOTICE '✅ [Auto Mark] Pedido % marcado via webhook válido (webhook_id: %)', 
          NEW.id, v_webhook_id;
      ELSE
        RAISE WARNING '⚠️ [Auto Mark] Pedido % não marcado - webhook não encontrado ou não processado (transaction_id: %)', 
          NEW.id, NEW.cakto_transaction_id;
      END IF;
    END IF;
    
    -- CENÁRIO 2: Marcação manual (já validada pelo trigger_validate_cakto_payment)
    -- Apenas garantir paid_at
    IF OLD.status = 'pending' 
       AND NEW.status = 'paid'
       AND NEW.cakto_webhook_metadata IS NOT NULL
       AND NEW.cakto_webhook_metadata->>'manual_mark' = 'true' THEN
      NEW.paid_at := COALESCE(NEW.paid_at, NEW.created_at);
      NEW.updated_at := NOW();
      
      RAISE NOTICE '✅ [Auto Mark] Pedido % marcado manualmente (via função mark_order_as_paid_manual)', NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Atualizar trigger existente
DROP TRIGGER IF EXISTS trigger_auto_mark_cakto_paid ON orders;
CREATE TRIGGER trigger_auto_mark_cakto_paid
  BEFORE UPDATE ON orders
  FOR EACH ROW
  WHEN (
    (NEW.provider = 'cakto' OR NEW.payment_provider = 'cakto')
    AND (
      -- Acionar para marcação automática (cakto_payment_status mudou)
      (NEW.status = 'pending'
       AND NEW.cakto_payment_status IN ('approved', 'paid', 'pago', 'aprovada')
       AND (OLD.cakto_payment_status IS NULL 
            OR OLD.cakto_payment_status NOT IN ('approved', 'paid', 'pago', 'aprovada')))
      OR
      -- Acionar para marcação manual (status mudou para paid com flag manual)
      (OLD.status = 'pending' 
       AND NEW.status = 'paid'
       AND NEW.cakto_webhook_metadata IS NOT NULL
       AND NEW.cakto_webhook_metadata->>'manual_mark' = 'true')
    )
  )
  EXECUTE FUNCTION trigger_auto_mark_cakto_paid();

COMMENT ON FUNCTION trigger_auto_mark_cakto_paid() IS 
'Trigger que marca automaticamente pedidos Cakto como pagos quando:
1. cakto_payment_status muda para approved E existe webhook válido processado
2. Pedido foi marcado manualmente via função mark_order_as_paid_manual';

COMMENT ON TRIGGER trigger_auto_mark_cakto_paid ON orders IS 
'Marca automaticamente pedidos Cakto como pagos quando há webhook válido ou marcação manual.';

-- ==============================
-- PARTE 4: ÍNDICES PARA PERFORMANCE
-- ==============================

-- Índice para busca rápida de webhooks por order_id e status
CREATE INDEX IF NOT EXISTS idx_cakto_webhooks_order_processed_status 
  ON cakto_webhooks(order_id, processed, status) 
  WHERE processed = true AND status = 'approved';

-- Índice para busca rápida de webhooks por transaction_id e status
CREATE INDEX IF NOT EXISTS idx_cakto_webhooks_transaction_processed_status 
  ON cakto_webhooks(transaction_id, processed, status) 
  WHERE processed = true AND status = 'approved';

-- Índice para busca de pedidos por webhook_id
CREATE INDEX IF NOT EXISTS idx_orders_cakto_webhook_id_status 
  ON orders(cakto_webhook_id, status) 
  WHERE provider = 'cakto' OR payment_provider = 'cakto';

COMMENT ON INDEX idx_cakto_webhooks_order_processed_status IS 
'Índice para validação rápida de webhooks válidos por pedido';

COMMENT ON INDEX idx_cakto_webhooks_transaction_processed_status IS 
'Índice para busca rápida de webhooks por transaction_id';

COMMENT ON INDEX idx_orders_cakto_webhook_id_status IS 
'Índice para busca de pedidos por webhook vinculado';

