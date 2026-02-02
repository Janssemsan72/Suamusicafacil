-- ==========================================
-- Melhorar trigger para usar fila assíncrona de emails
-- ==========================================
-- Modifica trigger_complete_payment_flow para adicionar à fila ao invés de chamar diretamente
-- Valida que pedido foi criado a partir de 26/11/2024 antes de adicionar à fila
-- ==========================================

-- Recriar a função do trigger para usar fila
CREATE OR REPLACE FUNCTION trigger_complete_payment_flow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id UUID;
  v_customer_email TEXT;
  v_order_created_at TIMESTAMPTZ;
  v_has_processed BOOLEAN;
  v_min_date TIMESTAMPTZ := '2024-11-26 00:00:00+00'::TIMESTAMPTZ;
  v_supabase_url TEXT;
  v_service_key TEXT;
BEGIN
  -- Só processar se status mudou para 'paid'
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    v_order_id := NEW.id;
    v_customer_email := NEW.customer_email;
    v_order_created_at := NEW.created_at;
    
    -- ✅ VALIDAÇÃO: Verificar se pedido foi criado a partir de 26/11/2024
    IF v_order_created_at < v_min_date THEN
      RAISE NOTICE 'ℹ️ [Trigger] Pedido % criado antes de 26/11/2024 - não adicionando à fila de email', v_order_id;
      -- Continuar com geração de letra mesmo assim (não bloqueia)
    ELSE
      -- Verificar se já foi processado (evitar duplicatas)
      -- Verificar se já existe email_log para este pedido
      SELECT EXISTS (
        SELECT 1 
        FROM email_logs 
        WHERE order_id = v_order_id 
          AND email_type = 'order_paid' 
          AND status IN ('sent', 'delivered')
      ) INTO v_has_processed;
      
      -- Verificar se já está na fila
      IF NOT v_has_processed AND NOT EXISTS (
        SELECT 1 
        FROM payment_email_queue 
        WHERE order_id = v_order_id 
          AND status IN ('pending', 'processing')
      ) THEN
        -- Adicionar à fila de emails (processamento assíncrono)
        BEGIN
          INSERT INTO payment_email_queue (
            order_id,
            order_created_at,
            status,
            retry_count,
            max_retries
          ) VALUES (
            v_order_id,
            v_order_created_at,
            'pending',
            0,
            5
          );
          
          RAISE NOTICE '✅ [Trigger] Pedido % adicionado à fila de emails (created_at: %)', v_order_id, v_order_created_at;
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING '⚠️ [Trigger] Erro ao adicionar pedido % à fila de emails: %', v_order_id, SQLERRM;
        END;
      ELSE
        RAISE NOTICE 'ℹ️ [Trigger] Pedido % já está processado ou na fila, pulando', v_order_id;
      END IF;
    END IF;
    
    -- PASSO 2: Iniciar geração automática de música via generate-lyrics-for-approval
    -- (Mantém chamada direta para geração de letra, pois não tem problema de rate limiting)
    BEGIN
      v_supabase_url := current_setting('app.settings.supabase_url', true);
      v_service_key := current_setting('app.settings.supabase_service_role_key', true);
      
      IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
        v_supabase_url := 'https://zagkvtxarndluusiluhb.supabase.co';
      END IF;
      
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
    
    RAISE NOTICE '✅ [Trigger] Fluxo de pagamento iniciado para pedido %', v_order_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Garantir que o trigger está habilitado
ALTER TABLE orders ENABLE TRIGGER trigger_complete_payment_flow;

-- Comentários
COMMENT ON FUNCTION trigger_complete_payment_flow() IS 
'Função do trigger que adiciona pedido à fila de emails quando status muda para paid. Valida que pedido foi criado a partir de 26/11/2024. Processamento assíncrono via fila evita timeouts e rate limiting em alta demanda.';

COMMENT ON TRIGGER trigger_complete_payment_flow ON orders IS 
'Trigger que adiciona pedido à fila de emails quando status muda para paid. Apenas pedidos criados a partir de 26/11/2024 são adicionados à fila.';










