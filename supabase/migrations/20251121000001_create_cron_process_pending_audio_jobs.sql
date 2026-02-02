-- ==========================================
-- Cron Job para processar automaticamente pedidos pendentes
-- Usa a função existente generate-audio-internal
-- Processa um pedido por vez a cada execução
-- ==========================================

-- Verificar se pg_cron está habilitado
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  END IF;
END $$;

-- Verificar se pg_net está habilitado
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    CREATE EXTENSION IF NOT EXISTS pg_net;
  END IF;
END $$;

-- Remover cron job existente se houver (para evitar duplicatas)
SELECT cron.unschedule('process-pending-audio-jobs-every-30s')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'process-pending-audio-jobs-every-30s'
);

-- Criar função auxiliar que busca um job pendente e chama generate-audio-internal
CREATE OR REPLACE FUNCTION process_next_pending_audio_job()
RETURNS TABLE(
  job_id TEXT,
  order_id TEXT,
  email TEXT,
  processed BOOLEAN,
  message TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job_id TEXT;
  v_order_id TEXT;
  v_email TEXT;
  v_supabase_url TEXT;
  v_service_key TEXT;
  v_request_id BIGINT;
BEGIN
  -- Obter configurações
  BEGIN
    v_supabase_url := current_setting('app.settings.supabase_url', true);
    v_service_key := current_setting('app.settings.supabase_service_role_key', true);
  EXCEPTION WHEN OTHERS THEN
    v_supabase_url := 'https://zagkvtxarndluusiluhb.supabase.co';
    v_service_key := NULL;
  END;
  
  -- Tentar obter service key do vault se não estiver nas configurações
  IF v_service_key IS NULL OR TRIM(v_service_key) = '' THEN
    SELECT decrypted_secret INTO v_service_key
    FROM vault.decrypted_secrets
    WHERE name = 'supabase_service_role_key'
    LIMIT 1;
  END IF;
  
  IF v_service_key IS NULL OR TRIM(v_service_key) = '' THEN
    RETURN QUERY SELECT 
      NULL::TEXT, 
      NULL::TEXT, 
      NULL::TEXT, 
      false, 
      'Service key não configurada'::TEXT;
    RETURN;
  END IF;
  
  -- Buscar um job pendente (mais antigo primeiro)
  SELECT 
    j.id,
    j.order_id,
    o.customer_email
  INTO v_job_id, v_order_id, v_email
  FROM jobs j
  INNER JOIN orders o ON o.id = j.order_id
  WHERE 
    o.status = 'paid' -- Apenas pedidos pagos
    AND j.status IN ('retry_pending', 'failed') -- Jobs que falharam ou estão aguardando retry
    AND j.gpt_lyrics IS NOT NULL -- Deve ter letra gerada
    AND (j.suno_task_id IS NULL OR j.suno_task_id = '') -- Ainda não tem task do Suno
    AND (
      j.error ILIKE '%credits%insufficient%' 
      OR j.error ILIKE '%créditos%insuficientes%'
      OR j.error ILIKE '%code 429%'
      OR j.error ILIKE '%top up%'
      OR j.error ILIKE '%Suno API error (code 429)%'
      OR j.error IS NULL
    )
  ORDER BY j.created_at ASC
  LIMIT 1;
  
  -- Se não encontrou job, retornar
  IF v_job_id IS NULL THEN
    RETURN QUERY SELECT 
      NULL::TEXT, 
      NULL::TEXT, 
      NULL::TEXT, 
      false, 
      'Nenhum job pendente encontrado'::TEXT;
    RETURN;
  END IF;
  
  -- Atualizar job para retry_pending
  UPDATE jobs
  SET 
    status = 'retry_pending',
    error = NULL,
    updated_at = NOW()
  WHERE id = v_job_id;
  
  -- Chamar função generate-audio-internal existente
  SELECT net.http_post(
    url := v_supabase_url || '/functions/v1/generate-audio-internal',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body := jsonb_build_object(
      'job_id', v_job_id
    ),
    timeout_milliseconds := 30000
  ) INTO v_request_id;
  
  -- Retornar resultado
  RETURN QUERY SELECT 
    v_job_id,
    v_order_id,
    v_email,
    true,
    'Job enviado para processamento. Request ID: ' || v_request_id::TEXT;
    
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT 
    v_job_id,
    v_order_id,
    v_email,
    false,
    'Erro: ' || SQLERRM;
END;
$$;

-- Criar cron job que chama a função a cada 30 segundos
SELECT cron.schedule(
  'process-pending-audio-jobs-every-30s',
  '*/30 * * * * *', -- A cada 30 segundos
  $$
  SELECT * FROM process_next_pending_audio_job();
  $$
);

-- Comentários
COMMENT ON FUNCTION process_next_pending_audio_job() IS 
'Processa automaticamente o próximo job pendente para geração de áudio. Busca jobs com status retry_pending ou failed que têm letra gerada mas ainda não têm suno_task_id, e chama a função generate-audio-internal existente. Processa UM job por execução.';

COMMENT ON FUNCTION cron.schedule IS 
'Cron job que processa automaticamente pedidos pendentes para geração de áudio. Executa a cada 30 segundos e processa UM pedido por vez usando a função generate-audio-internal existente.';

-- Verificar se o job foi criado
DO $$
DECLARE
  v_job_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_job_count
  FROM cron.job
  WHERE jobname = 'process-pending-audio-jobs-every-30s';
  
  IF v_job_count > 0 THEN
    RAISE NOTICE '✅ Cron job criado com sucesso: process-pending-audio-jobs-every-30s';
    RAISE NOTICE '   Frequência: A cada 30 segundos';
    RAISE NOTICE '   Processa: 1 pedido por execução';
    RAISE NOTICE '   Função usada: generate-audio-internal (existente)';
  ELSE
    RAISE WARNING '⚠️ Cron job não foi criado. Verifique os logs.';
  END IF;
END $$;
