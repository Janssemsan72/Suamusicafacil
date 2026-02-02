-- ==========================================
-- Trigger COMPLETO para fluxo de pagamento
-- ==========================================
-- Este trigger garante que quando um pedido é marcado como 'paid',
-- todo o fluxo seja executado:
-- 1. Envio de email e WhatsApp (via notify-payment-webhook)
-- 2. Geração automática de música (via generate-lyrics-for-approval)
-- ==========================================

-- Função que será executada pelo trigger
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

-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS trigger_complete_payment_flow ON orders;

-- Criar novo trigger
CREATE TRIGGER trigger_complete_payment_flow
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  WHEN (NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid'))
  EXECUTE FUNCTION trigger_complete_payment_flow();

-- Comentários
COMMENT ON FUNCTION trigger_complete_payment_flow() IS 
'Função do trigger que executa o fluxo completo de pagamento quando pedido é marcado como paid: envia email/WhatsApp via notify-payment-webhook e inicia geração de música via generate-lyrics-for-approval. Usa pg_net para chamar Edge Functions.';

COMMENT ON TRIGGER trigger_complete_payment_flow ON orders IS 
'Trigger que dispara fluxo completo de pagamento (email, WhatsApp e geração de música) quando status muda para paid.';

