-- Corrigir cron job para chamar release-scheduler
-- Esta migração corrige o cron job para apontar para a função correta

-- 1. Remover jobs antigos que apontam para funções incorretas
DO $$ 
DECLARE
    job_record RECORD;
BEGIN
    -- Remover jobs que apontam para scheduled-releases ou release-songs
    FOR job_record IN 
        SELECT jobname FROM cron.job 
        WHERE jobname LIKE '%scheduled-releases%' 
           OR jobname LIKE '%release-songs%'
           OR jobname LIKE '%release-scheduler%'
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

-- 2. Obter service_role_key do vault ou usar valor direto
DO $$
DECLARE
    service_role_key TEXT;
    project_ref TEXT := 'zagkvtxarndluusiluhb';
    function_url TEXT;
BEGIN
    -- Tentar obter service_role do vault
    BEGIN
        SELECT decrypted_secret INTO service_role_key
        FROM vault.decrypted_secrets
        WHERE name = 'service_role';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Não foi possível obter service_role do vault, usando valor direto';
            -- Valor direto do service_role (será substituído por vault se possível)
            service_role_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphZ2t2dHhhcm5kbHV1c2lsdWhiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc1NzA1NSwiZXhwIjoyMDc2MzMzMDU1fQ.3nw8wk1iuy97ZbRkH8P1pU-_4KK9Et-u0pK8Dl2F2TM';
    END;

    function_url := 'https://' || project_ref || '.supabase.co/functions/v1/release-scheduler';

    -- 3. Criar cron job para release-scheduler (a cada 5 minutos)
    PERFORM cron.schedule(
      'release-scheduler-every-5min',
      '*/5 * * * *', -- A cada 5 minutos
      format($sql$
        SELECT net.http_post(
          url := '%s',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer %s'
          ),
          body := '{}'::jsonb
        ) as request_id;
      $sql$, function_url, service_role_key)
    );

    RAISE NOTICE 'Cron job release-scheduler criado com sucesso';
END $$;

-- 4. Verificar se o job foi criado
SELECT 
  jobname, 
  schedule, 
  active,
  jobid
FROM cron.job 
WHERE jobname = 'release-scheduler-every-5min';

