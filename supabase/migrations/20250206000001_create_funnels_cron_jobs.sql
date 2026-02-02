-- ==========================================
-- Cron Jobs para criar funis e verificar pagamentos
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
        WHERE jobname LIKE '%create-funnels%' 
           OR jobname LIKE '%check-paid-funnels%'
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

-- 3. Configurar cron job para criar funis (a cada 3 minutos)
SELECT cron.schedule(
  'create-funnels-every-3min',
  '*/3 * * * *', -- A cada 3 minutos
  $$
  SELECT create_whatsapp_funnels_for_pending_orders();
  $$
);

-- 4. Configurar cron job para verificar pagamentos (a cada 5 minutos)
SELECT cron.schedule(
  'check-paid-funnels-every-5min',
  '*/5 * * * *', -- A cada 5 minutos
  $$
  SELECT check_paid_orders_in_funnel();
  $$
);

-- 5. Verificar se os jobs foram criados corretamente
SELECT 
  jobname, 
  schedule, 
  active,
  jobid
FROM cron.job 
WHERE jobname IN ('create-funnels-every-3min', 'check-paid-funnels-every-5min');

