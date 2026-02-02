-- ==========================================
-- Configuração dos cron jobs para funil WhatsApp
-- ==========================================

-- 1. Habilitar extensões necessárias (se não existirem)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Remover jobs existentes que possam conflitar
DO $$ 
DECLARE
    job_record RECORD;
BEGIN
    FOR job_record IN 
        SELECT jobname FROM cron.job 
        WHERE jobname LIKE '%check-pending-orders%' 
           OR jobname LIKE '%process-funnel%'
           OR jobname LIKE '%whatsapp-funnel%'
    LOOP
        BEGIN
            PERFORM cron.unschedule(job_record.jobname);
            RAISE NOTICE 'Removido job existente: %', job_record.jobname;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Não foi possível remover job %: %', job_record.jobname, SQLERRM;
        END;
    END LOOP;
END $$;

-- 3. Configurar cron job para verificar pedidos pendentes (a cada minuto)
SELECT cron.schedule(
  'check-pending-orders-every-1min',
  '* * * * *', -- A cada minuto
  $$
  SELECT net.http_post(
    url := 'https://zagkvtxarndluusiluhb.supabase.co/functions/v1/check-pending-orders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- 4. Configurar cron job para processar funil (a cada 5 minutos)
SELECT cron.schedule(
  'process-funnel-every-5min',
  '*/5 * * * *', -- A cada 5 minutos
  $$
  SELECT net.http_post(
    url := 'https://zagkvtxarndluusiluhb.supabase.co/functions/v1/process-funnel',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- 5. Verificar se os jobs foram criados corretamente
SELECT 
  jobname, 
  schedule, 
  active,
  jobid
FROM cron.job 
WHERE jobname IN ('check-pending-orders-every-1min', 'process-funnel-every-5min');

