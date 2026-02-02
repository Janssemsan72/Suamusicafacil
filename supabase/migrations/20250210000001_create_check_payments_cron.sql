-- ==========================================
-- Criar Cron Job para Verificar Pagamentos
-- ==========================================
-- Adiciona cron job para executar check-payments a cada 1 minuto

-- 1. Habilitar extensões necessárias (se não existirem)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Remover job existente se houver
DO $$ 
DECLARE
    job_record RECORD;
BEGIN
    FOR job_record IN 
        SELECT jobname FROM cron.job 
        WHERE jobname LIKE '%check-payments%'
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

-- 3. Obter URL do Supabase e service_role_key
DO $$
DECLARE
    v_supabase_url TEXT := 'https://zagkvtxarndluusiluhb.supabase.co';
    v_service_role_key TEXT;
BEGIN
    -- Obter service_role_key usando função auxiliar (se existir)
    BEGIN
        SELECT get_service_role_key() INTO v_service_role_key;
    EXCEPTION
        WHEN OTHERS THEN
            -- Se função não existir, tentar current_setting
            BEGIN
                v_service_role_key := current_setting('app.settings.service_role_key', true);
            EXCEPTION
                WHEN OTHERS THEN
                    v_service_role_key := NULL;
            END;
    END;
    
    -- 4. Configurar cron job para verificar pagamentos (a cada 1 minuto)
    PERFORM cron.schedule(
      'check-payments-every-1min',
      '* * * * *', -- A cada minuto
      format($sql$
        SELECT net.http_post(
          url := '%s/functions/v1/check-payments',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', CASE 
              WHEN %L IS NOT NULL THEN 'Bearer ' || %L
              ELSE 'Bearer ' || current_setting('app.settings.service_role_key', true)
            END
          ),
          body := '{}'::jsonb
        ) as request_id;
      $sql$, v_supabase_url, v_service_role_key, v_service_role_key)
    );
    
    RAISE NOTICE '✅ Cron job check-payments configurado';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Erro ao configurar cron job check-payments: %', SQLERRM;
END $$;

-- 5. Verificar se o job foi criado corretamente
SELECT 
  jobname, 
  schedule, 
  active,
  jobid
FROM cron.job 
WHERE jobname = 'check-payments-every-1min';

