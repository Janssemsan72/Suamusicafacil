-- ==========================================
-- Correção: Garantir que marcação automática de pagamento funcione
-- ==========================================
-- Este script garante que:
-- 1. O trigger trigger_complete_payment_flow está habilitado
-- 2. A função mark_funnel_and_order_as_paid está correta
-- 3. O trigger dispara corretamente quando status muda para 'paid'
-- ==========================================

-- 1. Garantir que a função mark_funnel_and_order_as_paid está correta
CREATE OR REPLACE FUNCTION mark_funnel_and_order_as_paid(p_order_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_funnel RECORD;
  v_funnel_id UUID;
  v_current_status TEXT;
BEGIN
  -- Verificar status atual do pedido
  SELECT status INTO v_current_status
  FROM orders
  WHERE id = p_order_id;
  
  -- Se pedido não existe, retornar NULL
  IF v_current_status IS NULL THEN
    RAISE WARNING 'Pedido não encontrado: %', p_order_id;
    RETURN NULL;
  END IF;
  
  -- Atualizar order para paid
  -- IMPORTANTE: Se paid_at não existir, usar created_at (data de criação da ordem)
  -- para que a venda seja contada na data correta, não na data em que foi marcada como paga
  UPDATE orders
  SET 
    status = 'paid',
    paid_at = COALESCE(paid_at, created_at),
    updated_at = NOW()
  WHERE id = p_order_id;
  
  -- Verificar se a atualização foi bem-sucedida
  IF NOT FOUND THEN
    RAISE WARNING 'Nenhuma linha atualizada para o pedido: %', p_order_id;
    RETURN NULL;
  END IF;
  
  -- Buscar funil em pending
  SELECT id INTO v_funnel_id
  FROM whatsapp_funnel_pending
  WHERE order_id = p_order_id
  LIMIT 1;
  
  -- Se encontrou funil, mover para completed
  IF v_funnel_id IS NOT NULL THEN
    BEGIN
      PERFORM move_funnel_to_completed(v_funnel_id);
      
      -- Cancelar mensagens pendentes
      UPDATE whatsapp_messages
      SET 
        status = 'cancelled',
        updated_at = NOW()
      WHERE funnel_id = v_funnel_id
        AND status = 'pending';
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Erro ao mover funil para completed: %', SQLERRM;
    END;
  END IF;
  
  RETURN v_funnel_id;
END;
$$;

-- 2. Garantir que o trigger está habilitado e funcionando
-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS trigger_complete_payment_flow ON orders;

-- Recriar a função do trigger (melhorada)
CREATE OR REPLACE FUNCTION trigger_complete_payment_flow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id UUID;
  v_customer_email TEXT;
  v_has_processed BOOLEAN;
  v_supabase_url TEXT;
  v_service_key TEXT;
BEGIN
  -- Só processar se status mudou para 'paid'
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    v_order_id := NEW.id;
    v_customer_email := NEW.customer_email;
    
    -- Verificar se já foi processado (evitar duplicatas)
    -- Verificar se já existe email_log para este pedido
    SELECT EXISTS (
      SELECT 1 
      FROM email_logs 
      WHERE order_id = v_order_id 
        AND email_type = 'order_paid' 
        AND status = 'sent'
    ) INTO v_has_processed;
    
    -- Se não foi processado, executar fluxo completo
    IF NOT v_has_processed THEN
      -- Obter configurações do Supabase
      v_supabase_url := current_setting('app.settings.supabase_url', true);
      v_service_key := current_setting('app.settings.supabase_service_role_key', true);
      
      -- Se não tiver configurações, tentar usar variáveis de ambiente padrão
      IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
        v_supabase_url := 'https://zagkvtxarndluusiluhb.supabase.co';
      END IF;
      
      -- PASSO 1: Enviar email e WhatsApp via notify-payment-webhook
      -- Este é o webhook centralizado que envia AMBOS email e WhatsApp
      BEGIN
        PERFORM net.http_post(
          url := v_supabase_url || '/functions/v1/notify-payment-webhook',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_key
          ),
          body := jsonb_build_object(
            'order_id', v_order_id::text
          )
        );
        
        RAISE NOTICE '✅ [Trigger] notify-payment-webhook chamado para pedido % (email: %)', v_order_id, v_customer_email;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '⚠️ [Trigger] Erro ao chamar notify-payment-webhook para pedido %: %', v_order_id, SQLERRM;
      END;
      
      -- PASSO 2: Iniciar geração automática de música via generate-lyrics-for-approval
      BEGIN
        PERFORM net.http_post(
          url := v_supabase_url || '/functions/v1/generate-lyrics-for-approval',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_key
          ),
          body := jsonb_build_object(
            'order_id', v_order_id::text
          )
        );
        
        RAISE NOTICE '✅ [Trigger] generate-lyrics-for-approval chamado para pedido %', v_order_id;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '⚠️ [Trigger] Erro ao chamar generate-lyrics-for-approval para pedido %: %', v_order_id, SQLERRM;
      END;
      
      RAISE NOTICE '✅ [Trigger] Fluxo completo de pagamento iniciado para pedido %', v_order_id;
    ELSE
      RAISE NOTICE 'ℹ️ [Trigger] Pedido % já foi processado anteriormente, pulando fluxo', v_order_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger (garantir que está habilitado)
CREATE TRIGGER trigger_complete_payment_flow
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  WHEN (NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid'))
  EXECUTE FUNCTION trigger_complete_payment_flow();

-- Garantir que o trigger está habilitado (não desabilitado)
ALTER TABLE orders ENABLE TRIGGER trigger_complete_payment_flow;

-- Comentários
COMMENT ON FUNCTION mark_funnel_and_order_as_paid(UUID) IS 
'Marca ordem como paga e move funil para completed simultaneamente. Sempre atualiza paid_at e updated_at, mesmo se pedido já estiver como paid.';

COMMENT ON FUNCTION trigger_complete_payment_flow() IS 
'Função do trigger que executa o fluxo completo de pagamento quando pedido é marcado como paid: envia email/WhatsApp via notify-payment-webhook e inicia geração de música via generate-lyrics-for-approval. Usa pg_net para chamar Edge Functions.';

COMMENT ON TRIGGER trigger_complete_payment_flow ON orders IS 
'Trigger que dispara fluxo completo de pagamento (email, WhatsApp e geração de música) quando status muda para paid.';


