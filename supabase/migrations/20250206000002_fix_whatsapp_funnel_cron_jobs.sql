-- ==========================================
-- Corrigir Cron Jobs do Funil WhatsApp
-- ==========================================
-- Esta migration corrige os cron jobs para usar service_role_key do vault
-- ou variável de ambiente, garantindo que as Edge Functions sejam chamadas

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
    BEGIN
        SELECT decrypted_secret INTO v_key
        FROM vault.decrypted_secrets
        WHERE name = 'service_role_key'
        LIMIT 1;
        
        IF v_key IS NOT NULL THEN
            RETURN v_key;
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            -- Se não conseguir do vault, continuar
            NULL;
    END;
    
    -- Se não encontrou no vault, tentar current_setting
    BEGIN
        v_key := current_setting('app.settings.service_role_key', true);
        IF v_key IS NOT NULL AND v_key != '' THEN
            RETURN v_key;
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            NULL;
    END;
    
    -- Se ainda não encontrou, retornar NULL (será tratado nas Edge Functions)
    RETURN NULL;
END;
$$;

-- 4. Obter URL do Supabase dinamicamente
-- Usar a URL do projeto atual (pode ser configurada via variável de ambiente)
DO $$
DECLARE
    v_supabase_url TEXT := 'https://zagkvtxarndluusiluhb.supabase.co';
    v_service_role_key TEXT;
BEGIN
    -- Obter service_role_key
    SELECT get_service_role_key() INTO v_service_role_key;
    
    -- Se não tiver service_role_key, usar abordagem alternativa
    -- As Edge Functions aceitarão chamadas sem CRON_SECRET se não estiver configurado
    
    -- 5. Configurar cron job para verificar pedidos pendentes (a cada minuto)
    PERFORM cron.schedule(
      'check-pending-orders-every-1min',
      '* * * * *', -- A cada minuto
      format($sql$
        SELECT net.http_post(
          url := '%s/functions/v1/check-pending-orders',
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
    
    RAISE NOTICE '✅ Cron job check-pending-orders configurado';
    
    -- 6. Configurar cron job para processar funil (a cada 5 minutos)
    PERFORM cron.schedule(
      'process-funnel-every-5min',
      '*/5 * * * *', -- A cada 5 minutos
      format($sql$
        SELECT net.http_post(
          url := '%s/functions/v1/process-funnel',
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
    
    RAISE NOTICE '✅ Cron job process-funnel configurado';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Erro ao configurar cron jobs: %', SQLERRM;
END $$;

-- 7. Verificar se os jobs foram criados corretamente
SELECT 
  jobname, 
  schedule, 
  active,
  jobid
FROM cron.job 
WHERE jobname IN ('check-pending-orders-every-1min', 'process-funnel-every-5min');

-- 8. Comentários
COMMENT ON FUNCTION get_service_role_key() IS 
'Função auxiliar para obter service_role_key do vault ou current_setting';

