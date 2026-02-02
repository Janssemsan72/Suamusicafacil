-- ==========================================
-- Configurar Cron Job para Funil de Email
-- ==========================================
-- Adiciona cron job para executar process-email-funnel a cada 5 minutos

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
        WHERE jobname LIKE '%process-email-funnel%'
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

-- 3. Função auxiliar para obter service_role_key do vault
CREATE OR REPLACE FUNCTION get_service_role_key()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_key TEXT;
BEGIN
    -- Tentar obter do vault primeiro
    SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key'
    LIMIT 1;
    
    -- Se não encontrou no vault, tentar current_setting
    IF v_key IS NULL THEN
        BEGIN
            v_key := current_setting('app.settings.service_role_key', true);
        EXCEPTION
            WHEN OTHERS THEN
                v_key := NULL;
        END;
    END IF;
    
    RETURN v_key;
END;
$$;

-- 4. Obter URL do Supabase e service_role_key
DO $$
DECLARE
    v_supabase_url TEXT;
    v_service_role_key TEXT;
BEGIN
    -- Obter URL do Supabase
    v_supabase_url := current_setting('app.settings.supabase_url', true);
    
    IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
        RAISE EXCEPTION 'app.settings.supabase_url não configurado';
    END IF;
    
    -- Obter service_role_key
    v_service_role_key := get_service_role_key();
    
    IF v_service_role_key IS NULL OR v_service_role_key = '' THEN
        RAISE WARNING 'service_role_key não encontrado no vault nem em current_setting. O cron job pode falhar.';
    END IF;
    
    -- 5. Configurar cron job para processar funil de email (a cada 5 minutos)
    PERFORM cron.schedule(
      'process-email-funnel-every-5min',
      '*/5 * * * *', -- A cada 5 minutos
      format($sql$
        SELECT net.http_post(
          url := '%s/functions/v1/process-email-funnel',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', CASE 
              WHEN %L IS NOT NULL THEN 'Bearer ' || %L
              ELSE 'Bearer ' || current_setting('app.settings.service_role_key', true)
            END
          ),
          body := '{}'::jsonb
        );
      $sql$, v_supabase_url, v_service_role_key, v_service_role_key)
    );
    
    RAISE NOTICE '✅ Cron job process-email-funnel configurado';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Erro ao configurar cron job process-email-funnel: %', SQLERRM;
END $$;

-- 6. Verificar se o job foi criado corretamente
SELECT 
  jobname, 
  schedule, 
  active,
  jobid
FROM cron.job 
WHERE jobname = 'process-email-funnel-every-5min';

-- 7. Comentários
COMMENT ON FUNCTION get_service_role_key() IS 
'Função auxiliar para obter service_role_key do vault ou current_setting';

