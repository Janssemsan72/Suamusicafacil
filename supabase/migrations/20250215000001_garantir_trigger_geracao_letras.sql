-- ==========================================
-- GARANTIR QUE O TRIGGER ESTÁ FUNCIONANDO CORRETAMENTE
-- ==========================================
-- Este migration garante que o trigger está habilitado e funcionando
-- para gerar letras automaticamente quando um pedido é marcado como pago
-- ==========================================

-- Instalar pg_net se não estiver instalado (necessário para chamar Edge Functions)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Garantir que a função está atualizada e funcionando
CREATE OR REPLACE FUNCTION trigger_complete_payment_flow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id UUID;
  v_customer_email TEXT;
  v_has_email_sent BOOLEAN;
  v_has_lyrics_generated BOOLEAN;
  v_supabase_url TEXT;
  v_service_key TEXT;
  v_has_valid_payment_indicator BOOLEAN;
BEGIN
  -- Só processar se status mudou para 'paid'
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    v_order_id := NEW.id;
    v_customer_email := NEW.customer_email;
    
    -- ✅ CORREÇÃO CRÍTICA: Verificar se pedido tem indicadores válidos de pagamento confirmado
    v_has_valid_payment_indicator := (
      -- Cakto: deve ter transaction_id E status approved
      (NEW.cakto_transaction_id IS NOT NULL AND NEW.cakto_transaction_id != '' 
       AND NEW.cakto_payment_status IN ('approved', 'paid', 'pago', 'aprovada'))
      OR
      -- Stripe: deve ter payment_intent_id
      (NEW.stripe_payment_intent_id IS NOT NULL AND NEW.stripe_payment_intent_id != '')
    );
    
    -- Verificar se letra já foi gerada (verificar se existe job com status != 'failed' OU approval)
    SELECT EXISTS (
      SELECT 1 
      FROM jobs j
      WHERE j.order_id = v_order_id
        AND j.status != 'failed'
    ) OR EXISTS (
      SELECT 1 
      FROM lyrics_approvals la
      WHERE la.order_id = v_order_id
    ) INTO v_has_lyrics_generated;
    
    -- ✅ CORREÇÃO: Se não tem indicador válido mas letra não foi gerada, tentar gerar mesmo assim (fallback)
    IF NOT v_has_valid_payment_indicator AND NOT v_has_lyrics_generated THEN
      RAISE NOTICE '⚠️ [Trigger] Pedido % marcado como paid mas SEM indicador válido. Tentando gerar letra como fallback.', v_order_id;
    END IF;
    
    -- Verificar se email já foi enviado
    SELECT EXISTS (
      SELECT 1 
      FROM email_logs 
      WHERE order_id = v_order_id 
        AND email_type = 'order_paid' 
        AND status = 'sent'
    ) INTO v_has_email_sent;
    
    -- Obter configurações do Supabase
    v_supabase_url := current_setting('app.settings.supabase_url', true);
    v_service_key := current_setting('app.settings.supabase_service_role_key', true);
    
    -- Se não tiver configurações, usar valores padrão
    IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
      v_supabase_url := 'https://zagkvtxarndluusiluhb.supabase.co';
    END IF;
    
    -- Se não tiver service key, tentar obter do vault
    IF v_service_key IS NULL OR v_service_key = '' THEN
      BEGIN
        SELECT decrypted_secret INTO v_service_key
        FROM vault.decrypted_secrets
        WHERE name = 'supabase_service_role_key'
        LIMIT 1;
      EXCEPTION WHEN OTHERS THEN
        -- Se não conseguir, usar variável de ambiente (será obtida pelo pg_net)
        v_service_key := NULL;
      END;
    END IF;
    
    -- PASSO 1: Enviar email e WhatsApp (só se não foi enviado E tem indicador válido)
    IF NOT v_has_email_sent AND v_has_valid_payment_indicator THEN
      BEGIN
        -- Chamar notify-payment-webhook via pg_net
        PERFORM net.http_post(
          url := v_supabase_url || '/functions/v1/notify-payment-webhook',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || COALESCE(v_service_key, '')
          ),
          body := jsonb_build_object(
            'order_id', v_order_id::text
          )
        );
        
        RAISE NOTICE '✅ [Trigger] notify-payment-webhook chamado para pedido % (email: %) - Pagamento confirmado via webhook', v_order_id, v_customer_email;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '⚠️ [Trigger] Erro ao chamar notify-payment-webhook para pedido %: %', v_order_id, SQLERRM;
      END;
    ELSIF v_has_email_sent THEN
      RAISE NOTICE 'ℹ️ [Trigger] Email já foi enviado para pedido %, pulando notify-payment-webhook', v_order_id;
    ELSIF NOT v_has_valid_payment_indicator THEN
      RAISE NOTICE 'ℹ️ [Trigger] Pedido % sem indicador válido de pagamento, pulando envio de email', v_order_id;
    END IF;
    
    -- PASSO 2: Gerar letra automaticamente (só se não foi gerada)
    -- ✅ CORREÇÃO: SEMPRE tentar gerar letra se não foi gerada, mesmo sem indicador válido (fallback)
    IF NOT v_has_lyrics_generated THEN
      BEGIN
        -- Chamar generate-lyrics-for-approval via pg_net
        PERFORM net.http_post(
          url := v_supabase_url || '/functions/v1/generate-lyrics-for-approval',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || COALESCE(v_service_key, '')
          ),
          body := jsonb_build_object(
            'order_id', v_order_id::text
          )
        );
        
        RAISE NOTICE '✅ [Trigger] generate-lyrics-for-approval chamado para pedido %', v_order_id;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '⚠️ [Trigger] Erro ao chamar generate-lyrics-for-approval para pedido %: %', v_order_id, SQLERRM;
        -- ✅ CORREÇÃO: Registrar erro no admin_logs para auditoria
        BEGIN
          INSERT INTO admin_logs (action, target_table, target_id, changes)
          VALUES (
            'trigger_generate_lyrics_failed',
            'orders',
            v_order_id,
            jsonb_build_object(
              'error', SQLERRM,
              'trigger', 'trigger_complete_payment_flow'
            )
          );
        EXCEPTION WHEN OTHERS THEN
          -- Ignorar erro ao registrar log (não bloquear)
          NULL;
        END;
      END;
    ELSE
      RAISE NOTICE 'ℹ️ [Trigger] Letra já foi gerada para pedido %, pulando generate-lyrics-for-approval', v_order_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ✅ CORREÇÃO: Garantir que o trigger está criado e habilitado
DROP TRIGGER IF EXISTS trigger_complete_payment_flow ON orders;

CREATE TRIGGER trigger_complete_payment_flow
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  WHEN (NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid'))
  EXECUTE FUNCTION trigger_complete_payment_flow();

-- ✅ CORREÇÃO: Habilitar trigger explicitamente (garantir que está ativo)
ALTER TABLE orders ENABLE TRIGGER trigger_complete_payment_flow;

-- Comentários atualizados
COMMENT ON FUNCTION trigger_complete_payment_flow() IS 
'Função do trigger que executa o fluxo completo de pagamento quando pedido é marcado como paid: envia email/WhatsApp via notify-payment-webhook (se não enviado E tem indicador válido) e SEMPRE inicia geração de música via generate-lyrics-for-approval (se não gerada, mesmo sem indicador válido como fallback). Usa pg_net para chamar Edge Functions.';

COMMENT ON TRIGGER trigger_complete_payment_flow ON orders IS 
'Trigger que dispara fluxo completo de pagamento (email, WhatsApp e geração de música) quando status muda para paid. Email só é enviado se pagamento foi confirmado via webhook (tem indicadores válidos). Letra SEMPRE é gerada se não foi gerada ainda (mesmo sem indicador válido como fallback). Verifica se email/letra já foram processados antes de executar.';

