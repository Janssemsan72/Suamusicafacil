-- ==========================================
-- Criar função e job para processar fila de emails de pagamento
-- ==========================================
-- Esta função processa itens pendentes da fila sequencialmente
-- Valida que pedido foi criado a partir de 26/11/2024 antes de processar
-- ==========================================

-- Data mínima para processamento (26/11/2024 00:00:00 UTC-3 = 26/11/2024 03:00:00 UTC)
-- Usando UTC para consistência
CREATE OR REPLACE FUNCTION process_payment_email_queue()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_queue_item RECORD;
  v_processed_count INTEGER := 0;
  v_supabase_url TEXT;
  v_service_key TEXT;
  v_min_date TIMESTAMPTZ := '2024-11-26 00:00:00+00'::TIMESTAMPTZ;
  v_result JSONB;
  v_error TEXT;
BEGIN
  -- Obter configurações do Supabase
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_service_key := current_setting('app.settings.supabase_service_role_key', true);
  
  -- Se não tiver configurações, usar valores padrão
  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    v_supabase_url := 'https://zagkvtxarndluusiluhb.supabase.co';
  END IF;
  
  -- Processar até 50 itens por execução (evitar timeout)
  FOR v_queue_item IN
    SELECT id, order_id, order_created_at, retry_count, max_retries
    FROM payment_email_queue
    WHERE status = 'pending'
      AND order_created_at >= v_min_date  -- ✅ VALIDAÇÃO: Apenas pedidos >= 26/11/2024
    ORDER BY created_at ASC
    LIMIT 50
    FOR UPDATE SKIP LOCKED  -- Evita processamento simultâneo do mesmo item
  LOOP
    BEGIN
      -- Marcar como processando
      UPDATE payment_email_queue
      SET 
        status = 'processing',
        updated_at = NOW()
      WHERE id = v_queue_item.id;
      
      -- ✅ VALIDAÇÃO DUPLA: Verificar novamente a data antes de processar
      IF v_queue_item.order_created_at < v_min_date THEN
        -- Pedido anterior a 26/11/2024 - marcar como sent (não processar)
        UPDATE payment_email_queue
        SET 
          status = 'sent',
          updated_at = NOW(),
          processed_at = NOW(),
          last_error = 'Pedido anterior a 26/11/2024 - não processar'
        WHERE id = v_queue_item.id;
        
        CONTINUE;
      END IF;
      
      -- Verificar se email já foi enviado (idempotência)
      IF EXISTS (
        SELECT 1 
        FROM email_logs 
        WHERE order_id = v_queue_item.order_id 
          AND email_type = 'order_paid' 
          AND status IN ('sent', 'delivered')
      ) THEN
        -- Email já foi enviado - marcar como sent
        UPDATE payment_email_queue
        SET 
          status = 'sent',
          updated_at = NOW(),
          processed_at = NOW()
        WHERE id = v_queue_item.id;
        
        v_processed_count := v_processed_count + 1;
        CONTINUE;
      END IF;
      
      -- Chamar notify-payment-webhook via pg_net
      BEGIN
        PERFORM net.http_post(
          url := v_supabase_url || '/functions/v1/notify-payment-webhook',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_key
          ),
          body := jsonb_build_object(
            'order_id', v_queue_item.order_id::text
          ),
          timeout_milliseconds := 30000  -- 30 segundos de timeout
        );
        
        -- Aguardar um pouco para verificar se foi processado
        PERFORM pg_sleep(2);
        
        -- Verificar se email foi enviado
        IF EXISTS (
          SELECT 1 
          FROM email_logs 
          WHERE order_id = v_queue_item.order_id 
            AND email_type = 'order_paid' 
            AND status IN ('sent', 'delivered')
        ) THEN
          -- Sucesso - marcar como sent
          UPDATE payment_email_queue
          SET 
            status = 'sent',
            updated_at = NOW(),
            processed_at = NOW()
          WHERE id = v_queue_item.id;
          
          v_processed_count := v_processed_count + 1;
        ELSE
          -- Ainda não foi enviado - pode ser que esteja processando
          -- Marcar como pending novamente para retry
          UPDATE payment_email_queue
          SET 
            status = 'pending',
            retry_count = v_queue_item.retry_count + 1,
            updated_at = NOW()
          WHERE id = v_queue_item.id;
        END IF;
        
      EXCEPTION WHEN OTHERS THEN
        v_error := SQLERRM;
        
        -- Verificar se ainda pode tentar novamente
        IF v_queue_item.retry_count < v_queue_item.max_retries THEN
          -- Marcar como pending para retry
          UPDATE payment_email_queue
          SET 
            status = 'pending',
            retry_count = v_queue_item.retry_count + 1,
            last_error = v_error,
            updated_at = NOW()
          WHERE id = v_queue_item.id;
        ELSE
          -- Esgotou tentativas - marcar como failed
          UPDATE payment_email_queue
          SET 
            status = 'failed',
            last_error = v_error,
            updated_at = NOW(),
            processed_at = NOW()
          WHERE id = v_queue_item.id;
        END IF;
      END;
      
    EXCEPTION WHEN OTHERS THEN
      -- Erro inesperado - marcar como failed se esgotou tentativas
      IF v_queue_item.retry_count >= v_queue_item.max_retries THEN
        UPDATE payment_email_queue
        SET 
          status = 'failed',
          last_error = SQLERRM,
          updated_at = NOW(),
          processed_at = NOW()
        WHERE id = v_queue_item.id;
      ELSE
        UPDATE payment_email_queue
        SET 
          status = 'pending',
          retry_count = v_queue_item.retry_count + 1,
          last_error = SQLERRM,
          updated_at = NOW()
        WHERE id = v_queue_item.id;
      END IF;
    END;
  END LOOP;
  
  RETURN v_processed_count;
END;
$$;

-- Comentários
COMMENT ON FUNCTION process_payment_email_queue() IS 'Processa itens pendentes da fila de emails de pagamento. Valida que pedido foi criado a partir de 26/11/2024 antes de processar. Processa até 50 itens por execução.';

-- Criar job agendado (pg_cron) para executar a cada 1 minuto
-- Nota: pg_cron precisa estar habilitado no Supabase
DO $$
BEGIN
  -- Remover job existente se houver
  PERFORM cron.unschedule('process-payment-email-queue');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Agendar job para executar a cada 1 minuto
SELECT cron.schedule(
  'process-payment-email-queue',
  '*/1 * * * *',  -- A cada 1 minuto
  $$SELECT process_payment_email_queue()$$
);

COMMENT ON FUNCTION process_payment_email_queue() IS 'Processa fila de emails de pagamento. Executa a cada 1 minuto via pg_cron. Valida data mínima (26/11/2024) e garante idempotência.';










