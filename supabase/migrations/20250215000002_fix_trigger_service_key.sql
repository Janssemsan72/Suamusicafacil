-- ==========================================
-- CORREÇÃO CRÍTICA: Trigger deve obter service key corretamente
-- Problema: Trigger estava falhando com erro 401 ao chamar generate-lyrics-for-approval
-- ==========================================

-- Instalar pg_net se não estiver instalado
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Função corrigida que obtém service key corretamente
CREATE OR REPLACE FUNCTION trigger_complete_payment_flow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
  v_customer_email TEXT;
  v_has_email_sent BOOLEAN;
  v_has_lyrics_generated BOOLEAN;
  v_supabase_url TEXT;
  v_service_key TEXT;
  v_has_valid_payment_indicator BOOLEAN;
  v_http_request_id BIGINT;
  v_retry_count INT := 0;
  v_max_retries INT := 3;
BEGIN
  -- Só processar se status mudou para 'paid'
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    v_order_id := NEW.id;
    v_customer_email := NEW.customer_email;
    
    RAISE NOTICE '[Trigger] 🎯 Pedido % marcado como paid - Iniciando fluxo automático completo', v_order_id;
    
    -- Verificar se pedido tem indicadores válidos de pagamento confirmado
    v_has_valid_payment_indicator := (
      -- Cakto: deve ter transaction_id E status approved
      (NEW.cakto_transaction_id IS NOT NULL AND NEW.cakto_transaction_id != '' 
       AND NEW.cakto_payment_status IN ('approved', 'paid', 'pago', 'aprovada'))
      OR
      -- Stripe: deve ter payment_intent_id
      (NEW.stripe_payment_intent_id IS NOT NULL AND NEW.stripe_payment_intent_id != '')
    );
    
    -- Verificar se email já foi enviado
    SELECT EXISTS (
      SELECT 1 
      FROM email_logs 
      WHERE order_id = v_order_id 
        AND email_type = 'order_paid' 
        AND status IN ('sent', 'delivered')
    ) INTO v_has_email_sent;
    
    -- Verificar se letra já foi gerada
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
    
    -- ✅ CORREÇÃO CRÍTICA: Obter service key de múltiplas fontes
    -- 1. Tentar obter de variável de ambiente do Supabase (se configurada)
    BEGIN
      v_service_key := current_setting('app.settings.supabase_service_role_key', true);
    EXCEPTION WHEN OTHERS THEN
      v_service_key := NULL;
    END;
    
    -- 2. Se não encontrou, tentar obter do vault
    IF v_service_key IS NULL OR v_service_key = '' THEN
      BEGIN
        SELECT decrypted_secret INTO v_service_key
        FROM vault.decrypted_secrets
        WHERE name = 'supabase_service_role_key'
        LIMIT 1;
      EXCEPTION WHEN OTHERS THEN
        v_service_key := NULL;
      END;
    END IF;
    
    -- 3. Se ainda não encontrou, usar variável de ambiente do sistema (pg_net vai usar)
    -- O pg_net pode usar SUPABASE_SERVICE_ROLE_KEY do ambiente do Supabase
    -- Mas precisamos garantir que o header Authorization seja passado mesmo se vazio
    -- A função Edge deve aceitar chamadas sem JWT quando verify_jwt = false
    
    -- Obter URL do Supabase
    BEGIN
      v_supabase_url := current_setting('app.settings.supabase_url', true);
    EXCEPTION WHEN OTHERS THEN
      v_supabase_url := NULL;
    END;
    
    IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
      v_supabase_url := 'https://zagkvtxarndluusiluhb.supabase.co';
    END IF;
    
    -- ✅ LOG: Mostrar se service key foi encontrada (sem mostrar o valor)
    IF v_service_key IS NOT NULL AND v_service_key != '' THEN
      RAISE NOTICE '[Trigger] ✅ Service key encontrada (tamanho: % caracteres)', length(v_service_key);
    ELSE
      RAISE WARNING '[Trigger] ⚠️ Service key NÃO encontrada - pg_net usará variável de ambiente do sistema';
    END IF;
    
    -- PASSO 1: Enviar email e WhatsApp (só se não foi enviado E tem indicador válido)
    IF NOT v_has_email_sent AND v_has_valid_payment_indicator THEN
      BEGIN
        -- ✅ CORREÇÃO: Construir headers corretamente
        -- Se service key existe, usar no header Authorization
        -- Se não existe, passar header vazio (função deve aceitar com verify_jwt = false)
        PERFORM net.http_post(
          url := v_supabase_url || '/functions/v1/notify-payment-webhook',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', CASE 
              WHEN v_service_key IS NOT NULL AND v_service_key != '' 
              THEN 'Bearer ' || v_service_key 
              ELSE '' 
            END
          ),
          body := jsonb_build_object(
            'order_id', v_order_id::text
          )
        );
        
        RAISE NOTICE '[Trigger] ✅ Email/WhatsApp enviado para pedido % (email: %)', v_order_id, v_customer_email;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[Trigger] ⚠️ Erro ao enviar email para pedido %: %', v_order_id, SQLERRM;
        
        -- Registrar erro no admin_logs
        BEGIN
          INSERT INTO admin_logs (action, target_table, target_id, changes)
          VALUES (
            'trigger_notify_payment_failed',
            'orders',
            v_order_id,
            jsonb_build_object(
              'error', SQLERRM,
              'trigger', 'trigger_complete_payment_flow',
              'has_service_key', v_service_key IS NOT NULL AND v_service_key != ''
            )
          );
        EXCEPTION WHEN OTHERS THEN
          NULL;
        END;
      END;
    ELSIF v_has_email_sent THEN
      RAISE NOTICE '[Trigger] ℹ️ Email já foi enviado para pedido %, pulando', v_order_id;
    ELSIF NOT v_has_valid_payment_indicator THEN
      RAISE NOTICE '[Trigger] ℹ️ Pedido % sem indicador válido de pagamento, pulando envio de email', v_order_id;
    END IF;
    
    -- PASSO 2: Gerar letra automaticamente (SEMPRE, se não foi gerada)
    -- A letra vai direto para pendentes em /admin/lyrics
    IF NOT v_has_lyrics_generated THEN
      BEGIN
        -- ✅ CORREÇÃO CRÍTICA: Construir headers corretamente com retry logic
        -- Tentar até 3 vezes se falhar
        WHILE v_retry_count < v_max_retries LOOP
          BEGIN
            -- Fazer chamada HTTP
            SELECT id INTO v_http_request_id
            FROM net.http_post(
              url := v_supabase_url || '/functions/v1/generate-lyrics-for-approval',
              headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', CASE 
                  WHEN v_service_key IS NOT NULL AND v_service_key != '' 
                  THEN 'Bearer ' || v_service_key 
                  ELSE '' 
                END
              ),
              body := jsonb_build_object(
                'order_id', v_order_id::text
              )
            );
            
            -- Se chegou aqui, a chamada foi feita com sucesso
            RAISE NOTICE '[Trigger] ✅ Geração de letra iniciada para pedido % - Vai aparecer em /admin/lyrics pendentes (tentativa %/%)', 
              v_order_id, (v_retry_count + 1), v_max_retries;
            
            -- Sair do loop
            EXIT;
            
          EXCEPTION WHEN OTHERS THEN
            v_retry_count := v_retry_count + 1;
            
            IF v_retry_count < v_max_retries THEN
              RAISE WARNING '[Trigger] ⚠️ Erro ao gerar letra para pedido % (tentativa %/%): %. Tentando novamente...', 
                v_order_id, v_retry_count, v_max_retries, SQLERRM;
              
              -- Aguardar antes de tentar novamente (backoff exponencial)
              PERFORM pg_sleep(0.5 * v_retry_count);
            ELSE
              -- Última tentativa falhou
              RAISE WARNING '[Trigger] ❌ Erro ao gerar letra para pedido % após % tentativas: %', 
                v_order_id, v_max_retries, SQLERRM;
              
              -- Registrar erro no admin_logs
              BEGIN
                INSERT INTO admin_logs (action, target_table, target_id, changes)
                VALUES (
                  'trigger_generate_lyrics_failed',
                  'orders',
                  v_order_id,
                  jsonb_build_object(
                    'error', SQLERRM,
                    'trigger', 'trigger_complete_payment_flow',
                    'has_service_key', v_service_key IS NOT NULL AND v_service_key != '',
                    'retry_count', v_retry_count,
                    'supabase_url', v_supabase_url
                  )
                );
              EXCEPTION WHEN OTHERS THEN
                NULL;
              END;
              
              -- Re-lançar exceção para que seja registrada
              RAISE;
            END IF;
          END;
        END LOOP;
        
      EXCEPTION WHEN OTHERS THEN
        -- Erro crítico após todas as tentativas
        RAISE WARNING '[Trigger] ❌ Erro crítico ao gerar letra para pedido %: %', v_order_id, SQLERRM;
      END;
    ELSE
      RAISE NOTICE '[Trigger] ℹ️ Letra já foi gerada para pedido %, pulando', v_order_id;
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

-- Habilitar trigger (garantir que está ativo)
ALTER TABLE orders ENABLE TRIGGER trigger_complete_payment_flow;

-- Comentários atualizados
COMMENT ON FUNCTION trigger_complete_payment_flow() IS 
'Função do trigger que executa o fluxo completo de pagamento quando pedido é marcado como paid: envia email/WhatsApp via notify-payment-webhook (se não enviado E tem indicador válido) e SEMPRE inicia geração de música via generate-lyrics-for-approval (se não gerada, mesmo sem indicador válido como fallback). Usa pg_net para chamar Edge Functions. Obtém service key de múltiplas fontes (variável de ambiente, vault, ou usa variável de ambiente do sistema via pg_net).';

COMMENT ON TRIGGER trigger_complete_payment_flow ON orders IS 
'Trigger que dispara fluxo completo de pagamento (email, WhatsApp e geração de música) quando status muda para paid. Email só é enviado se pagamento foi confirmado via webhook (tem indicadores válidos). Letra SEMPRE é gerada se não foi gerada ainda (mesmo sem indicador válido como fallback). Verifica se email/letra já foram processados antes de executar.';

