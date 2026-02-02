-- ==========================================
-- Cron Job para processar fila de retry de quizzes
-- Processa automaticamente quizzes que falharam ao ser salvos
-- Executa a cada 2 minutos
-- ==========================================

-- 1. Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Remover cron job existente se houver (para evitar duplicatas)
SELECT cron.unschedule('process-quiz-retry-queue-every-2min')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'process-quiz-retry-queue-every-2min'
);

-- 3. Criar cron job para processar fila de retry de quizzes (a cada 2 minutos)
SELECT cron.schedule(
  'process-quiz-retry-queue-every-2min',
  '*/2 * * * *', -- A cada 2 minutos
  $$
  SELECT net.http_post(
    url := 'https://zagkvtxarndluusiluhb.supabase.co/functions/v1/process-quiz-retry-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) as request_id;
  $$
);

-- 4. Verificar se o cron job foi criado corretamente
DO $$
DECLARE
  v_job_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_job_count
  FROM cron.job
  WHERE jobname = 'process-quiz-retry-queue-every-2min';
  
  IF v_job_count > 0 THEN
    RAISE NOTICE '✅ Cron job criado com sucesso: process-quiz-retry-queue-every-2min';
    RAISE NOTICE '   Frequência: A cada 2 minutos';
    RAISE NOTICE '   Edge Function: process-quiz-retry-queue';
    RAISE NOTICE '   Processa: Até 50 itens por execução';
  ELSE
    RAISE WARNING '⚠️ Cron job não foi criado. Verifique os logs.';
  END IF;
END $$;

-- 5. Listar job criado para confirmação
SELECT 
  jobname, 
  schedule, 
  active,
  jobid
FROM cron.job 
WHERE jobname = 'process-quiz-retry-queue-every-2min';

-- Comentários para documentação
COMMENT ON EXTENSION pg_cron IS 'Extensão para agendamento de tarefas (cron jobs)';
COMMENT ON EXTENSION pg_net IS 'Extensão para fazer requisições HTTP a partir do PostgreSQL';

