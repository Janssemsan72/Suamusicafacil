-- ==========================================
-- Criar job de recuperação para pedidos pagos sem email
-- ==========================================
-- Job executa a cada 5 minutos e busca pedidos pagos sem email
-- Apenas pedidos criados a partir de 26/11/2024 são processados
-- ==========================================

CREATE OR REPLACE FUNCTION recover_payment_emails()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
  v_recovered_count INTEGER := 0;
  v_min_date TIMESTAMPTZ := '2024-11-26 00:00:00+00'::TIMESTAMPTZ;
BEGIN
  -- Buscar pedidos pagos sem email criados a partir de 26/11/2024
  -- Limitar a 100 pedidos por execução para evitar timeout
  FOR v_order IN
    SELECT 
      o.id,
      o.created_at,
      o.customer_email
    FROM orders o
    WHERE o.status = 'paid'
      AND o.created_at >= v_min_date  -- ✅ Apenas pedidos >= 26/11/2024
      AND o.customer_email IS NOT NULL
      AND o.customer_email != ''
      -- Verificar se não tem email enviado
      AND NOT EXISTS (
        SELECT 1 
        FROM email_logs el
        WHERE el.order_id = o.id
          AND el.email_type = 'order_paid'
          AND el.status IN ('sent', 'delivered')
      )
      -- Verificar se não está na fila
      AND NOT EXISTS (
        SELECT 1 
        FROM payment_email_queue peq
        WHERE peq.order_id = o.id
          AND peq.status IN ('pending', 'processing')
      )
    ORDER BY o.created_at DESC
    LIMIT 100
  LOOP
    BEGIN
      -- Adicionar à fila
      INSERT INTO payment_email_queue (
        order_id,
        order_created_at,
        status,
        retry_count,
        max_retries
      ) VALUES (
        v_order.id,
        v_order.created_at,
        'pending',
        0,
        5
      )
      ON CONFLICT DO NOTHING;  -- Evitar duplicatas
      
      v_recovered_count := v_recovered_count + 1;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '⚠️ [Recovery Job] Erro ao adicionar pedido % à fila: %', v_order.id, SQLERRM;
    END;
  END LOOP;
  
  IF v_recovered_count > 0 THEN
    RAISE NOTICE '✅ [Recovery Job] % pedido(s) adicionado(s) à fila de emails', v_recovered_count;
  END IF;
  
  RETURN v_recovered_count;
END;
$$;

-- Comentários
COMMENT ON FUNCTION recover_payment_emails() IS 'Busca pedidos pagos sem email criados a partir de 26/11/2024 e adiciona à fila de processamento. Executa a cada 5 minutos via pg_cron.';

-- Criar job agendado (pg_cron) para executar a cada 5 minutos
DO $$
BEGIN
  -- Remover job existente se houver
  PERFORM cron.unschedule('recover-payment-emails');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Agendar job para executar a cada 5 minutos
SELECT cron.schedule(
  'recover-payment-emails',
  '*/5 * * * *',  -- A cada 5 minutos
  $$SELECT recover_payment_emails()$$
);

COMMENT ON FUNCTION recover_payment_emails() IS 'Job de recuperação que busca pedidos pagos sem email (apenas >= 26/11/2024) e adiciona à fila. Executa a cada 5 minutos.';










