-- ==========================================
-- REMOVER VERIFICAÇÃO QUE BLOQUEIA GERAÇÃO DE LETRA
-- ==========================================
-- Esta migração remove a verificação que impede gerar nova letra
-- quando já existe uma letra gerada, permitindo sempre gerar novas letras
-- ==========================================

CREATE OR REPLACE FUNCTION trigger_complete_payment_flow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id UUID;
  v_customer_email TEXT;
  v_supabase_url TEXT;
  v_service_key TEXT;
  v_has_email_sent BOOLEAN;
  v_has_valid_payment_indicator BOOLEAN;
BEGIN
  -- ✅ Só processar se status mudou para 'paid'
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    v_order_id := NEW.id;
    v_customer_email := NEW.customer_email;
    
    RAISE NOTICE '🎯 [Trigger Payment Flow] Pedido % marcado como paid - Iniciando fluxo', v_order_id;
    
    -- Verificar se tem indicador válido de pagamento
    v_has_valid_payment_indicator := (
      (NEW.cakto_transaction_id IS NOT NULL AND NEW.cakto_transaction_id != '' 
       AND NEW.cakto_payment_status IN ('approved', 'paid', 'pago', 'aprovada'))
      OR
      (NEW.stripe_payment_intent_id IS NOT NULL AND NEW.stripe_payment_intent_id != '')
    );
    
    -- Verificar se email já foi enviado
    SELECT EXISTS (
      SELECT 1 FROM email_logs 
      WHERE order_id = v_order_id 
        AND email_type = 'order_paid' 
        AND status IN ('sent', 'delivered')
    ) INTO v_has_email_sent;
    
    -- Obter configurações com valor padrão SEMPRE definido
    BEGIN
      v_supabase_url := current_setting('app.settings.supabase_url', true);
      v_service_key := current_setting('app.settings.supabase_service_role_key', true);
    EXCEPTION WHEN OTHERS THEN
      v_supabase_url := NULL;
      v_service_key := NULL;
    END;
    
    -- ✅ CORREÇÃO CRÍTICA: SEMPRE garantir URL válida antes de qualquer operação
    IF v_supabase_url IS NULL OR TRIM(v_supabase_url) = '' THEN
      v_supabase_url := 'https://zagkvtxarndluusiluhb.supabase.co';
      RAISE NOTICE '⚠️ [Trigger] Usando URL padrão hardcoded: %', v_supabase_url;
    END IF;
    
    -- Tentar obter service key do vault se não tiver
    IF v_service_key IS NULL OR TRIM(v_service_key) = '' THEN
      BEGIN
        SELECT decrypted_secret INTO v_service_key
        FROM vault.decrypted_secrets
        WHERE name = 'supabase_service_role_key'
        LIMIT 1;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '⚠️ [Trigger] Não foi possível obter service key do vault: %', SQLERRM;
      END;
    END IF;
    
    -- ✅ VALIDAÇÃO FINAL: Verificar se temos URL e service key válidos antes de continuar
    IF v_supabase_url IS NULL OR TRIM(v_supabase_url) = '' THEN
      RAISE WARNING '❌ [Trigger] URL do Supabase não pode ser NULL ou vazia - abortando processamento para pedido %', v_order_id;
      RETURN NEW;
    END IF;
    
    IF v_service_key IS NULL OR TRIM(v_service_key) = '' THEN
      RAISE WARNING '❌ [Trigger] Service key não disponível - abortando processamento para pedido %', v_order_id;
      RETURN NEW;
    END IF;
    
    -- PASSO 1: Enviar email (se não foi enviado E tem indicador válido)
    IF NOT v_has_email_sent AND v_has_valid_payment_indicator THEN
      BEGIN
        PERFORM net.http_post(
          url := v_supabase_url || '/functions/v1/notify-payment-webhook',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_key
          ),
          body := jsonb_build_object('order_id', v_order_id::text),
          timeout_milliseconds := 5000
        );
        RAISE NOTICE '✅ [Trigger] notify-payment-webhook chamado para pedido %', v_order_id;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '⚠️ [Trigger] Erro ao chamar notify-payment-webhook para pedido %: %', v_order_id, SQLERRM;
      END;
    ELSIF v_has_email_sent THEN
      RAISE NOTICE 'ℹ️ [Trigger] Email já foi enviado para pedido % - pulando', v_order_id;
    ELSIF NOT v_has_valid_payment_indicator THEN
      RAISE NOTICE 'ℹ️ [Trigger] Pedido % não tem indicador válido de pagamento - pulando envio de email', v_order_id;
    END IF;
    
    -- ✅ LÓGICA PERMISSIVA: SEMPRE gerar letra (removida verificação de letra existente)
    -- A função generate-lyrics-for-approval agora deleta letras antigas antes de criar novas
    BEGIN
      RAISE NOTICE '🎵 [Trigger] Iniciando geração de letra para pedido % (lógica permissiva - sempre gera)', v_order_id;
      
      PERFORM net.http_post(
        url := v_supabase_url || '/functions/v1/generate-lyrics-for-approval',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_key,
          'apikey', v_service_key
        ),
        body := jsonb_build_object('order_id', v_order_id::text),
        timeout_milliseconds := 10000
      );
      
      RAISE NOTICE '✅ [Trigger] generate-lyrics-for-approval chamado para pedido % - Geração automática iniciada', v_order_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '❌ [Trigger] Erro ao chamar generate-lyrics-for-approval para pedido %: %', v_order_id, SQLERRM;
      
      -- ✅ CORREÇÃO: Registrar erro em admin_logs para investigação
      BEGIN
        INSERT INTO admin_logs (
          action,
          target_table,
          target_id,
          changes
        ) VALUES (
          'trigger_generate_lyrics_failed',
          'orders',
          v_order_id,
          jsonb_build_object(
            'order_id', v_order_id,
            'customer_email', v_customer_email,
            'trigger', 'trigger_complete_payment_flow',
            'error_message', SQLERRM
          )
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '⚠️ [Trigger] Erro ao registrar log de erro: %', SQLERRM;
      END;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Comentários atualizados
COMMENT ON FUNCTION trigger_complete_payment_flow() IS 
'Função do trigger que executa o fluxo completo de pagamento quando pedido é marcado como paid: envia email via notify-payment-webhook (se tem indicador válido) e SEMPRE gera letra via generate-lyrics-for-approval (lógica permissiva - sempre gera, deletando letras antigas). Usa pg_net para chamar Edge Functions.';

COMMENT ON TRIGGER trigger_complete_payment_flow ON orders IS 
'Trigger que dispara fluxo completo de pagamento (email e geração de música) quando status muda para paid. Email só é enviado se pagamento foi confirmado via webhook (tem indicadores válidos). Letra SEMPRE é gerada (lógica permissiva - deleta letras antigas antes de criar novas).';


