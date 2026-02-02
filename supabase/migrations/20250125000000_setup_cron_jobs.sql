-- Configuração dos cron jobs para agendamento de emails
-- Esta migração configura os cron jobs necessários para o sistema

-- 1. Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Remover jobs existentes que possam conflitar
DO $$ 
DECLARE
    job_record RECORD;
BEGIN
    -- Remover jobs de scheduled-releases existentes
    FOR job_record IN 
        SELECT jobname FROM cron.job 
        WHERE jobname LIKE '%scheduled-releases%' 
           OR jobname LIKE '%release-songs%'
           OR jobname LIKE '%poll-suno-status%'
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

-- 3. Configurar cron job para releases agendados (a cada 10 minutos)
SELECT cron.schedule(
  'scheduled-releases-every-10min',
  '*/10 * * * *', -- A cada 10 minutos
  $$
  SELECT net.http_post(
    url := 'https://zagkvtxarndluusiluhb.supabase.co/functions/v1/scheduled-releases',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- 4. Configurar cron job para verificar status do Suno (a cada 2 minutos)
SELECT cron.schedule(
  'poll-suno-status-every-2min',
  '*/2 * * * *', -- A cada 2 minutos
  $$
  SELECT net.http_post(
    url := 'https://zagkvtxarndluusiluhb.supabase.co/functions/v1/poll-suno-status',
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
WHERE jobname IN ('scheduled-releases-every-10min', 'poll-suno-status-every-2min');

-- 6. Log de confirmação (comentado - tabela system_logs não existe)
-- INSERT INTO public.system_logs (message, level, metadata) VALUES (
--   'Cron jobs configurados com sucesso: scheduled-releases (10min) e poll-suno-status (2min)',
--   'info',
--   jsonb_build_object(
--     'migration', '20250125000000_setup_cron_jobs',
--     'jobs_created', 2,
--     'scheduled_releases_schedule', '*/10 * * * *',
--     'poll_suno_schedule', '*/2 * * * *'
--   )
-- ) ON CONFLICT DO NOTHING;
