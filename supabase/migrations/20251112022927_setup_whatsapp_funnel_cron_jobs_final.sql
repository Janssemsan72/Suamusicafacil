-- ==========================================
-- Configuração Final dos Cron Jobs do Funil WhatsApp
-- ==========================================
-- Esta migração configura os cron jobs necessários para o envio automático
-- de mensagens do funil WhatsApp nos intervalos corretos

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

-- 3. Função auxiliar para obter service_role_key do vault ou current_setting
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

-- 4. Obter URL do Supabase dinamicamente e configurar cron jobs
DO $$
DECLARE
    v_supabase_url TEXT;
    v_service_role_key TEXT;
BEGIN
    -- Tentar obter URL do Supabase das variáveis de ambiente ou usar padrão
    BEGIN
        v_supabase_url := current_setting('app.settings.supabase_url', true);
        IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
            v_supabase_url := 'https://zagkvtxarndluusiluhb.supabase.co';
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            v_supabase_url := 'https://zagkvtxarndluusiluhb.supabase.co';
    END;
    
    -- Obter service_role_key
    SELECT get_service_role_key() INTO v_service_role_key;
    
    RAISE NOTICE 'Supabase URL: %', v_supabase_url;
    RAISE NOTICE 'Service Role Key: %', CASE WHEN v_service_role_key IS NOT NULL THEN 'Configurado' ELSE 'Não configurado (usará current_setting)' END;
    
    -- 5. Configurar cron job para verificar pedidos pendentes (a cada 1 minuto)
    -- Este job verifica pedidos pending há mais de 7 minutos e envia primeira mensagem
    -- Nota: As Edge Functions aceitam service_role_key ou CRON_SECRET
    -- Se não tiver service_role_key configurado, as Edge Functions ainda funcionarão
    -- mas podem precisar de CRON_SECRET configurado nas variáveis de ambiente
    PERFORM cron.schedule(
      'check-pending-orders-every-1min',
      '* * * * *', -- A cada minuto
      format($sql$
        SELECT net.http_post(
          url := '%s/functions/v1/check-pending-orders',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', CASE 
              WHEN %L IS NOT NULL AND %L != '' THEN 'Bearer ' || %L
              ELSE 'Bearer ' || COALESCE(
                NULLIF(current_setting('app.settings.service_role_key', true), ''),
                (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1),
                ''
              )
            END
          ),
          body := '{}'::jsonb
        ) as request_id;
      $sql$, v_supabase_url, v_service_role_key, v_service_role_key)
    );
    
    RAISE NOTICE '✅ Cron job check-pending-orders-every-1min configurado (executa a cada 1 minuto)';
    
    -- 6. Configurar cron job para processar funil (a cada 5 minutos)
    -- Este job processa mensagens agendadas do funil (follow_up_1, follow_up_2, follow_up_3)
    -- Nota: As Edge Functions aceitam service_role_key ou CRON_SECRET
    -- Se não tiver service_role_key configurado, as Edge Functions ainda funcionarão
    -- mas podem precisar de CRON_SECRET configurado nas variáveis de ambiente
    PERFORM cron.schedule(
      'process-funnel-every-5min',
      '*/5 * * * *', -- A cada 5 minutos
      format($sql$
        SELECT net.http_post(
          url := '%s/functions/v1/process-funnel',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', CASE 
              WHEN %L IS NOT NULL AND %L != '' THEN 'Bearer ' || %L
              ELSE 'Bearer ' || COALESCE(
                NULLIF(current_setting('app.settings.service_role_key', true), ''),
                (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1),
                ''
              )
            END
          ),
          body := '{}'::jsonb
        ) as request_id;
      $sql$, v_supabase_url, v_service_role_key, v_service_role_key)
    );
    
    RAISE NOTICE '✅ Cron job process-funnel-every-5min configurado (executa a cada 5 minutos)';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Erro ao configurar cron jobs: %', SQLERRM;
        RAISE WARNING 'Stack trace: %', SQLSTATE;
END $$;

-- 7. Verificar se os jobs foram criados corretamente
SELECT 
  jobid,
  jobname, 
  schedule, 
  active,
  CASE 
    WHEN active THEN '✅ ATIVO'
    ELSE '❌ INATIVO'
  END as status
FROM cron.job 
WHERE jobname IN ('check-pending-orders-every-1min', 'process-funnel-every-5min')
ORDER BY jobname;

-- 8. Comentários e documentação
COMMENT ON FUNCTION get_service_role_key() IS 
'Função auxiliar para obter service_role_key do vault ou current_setting. Usada pelos cron jobs para autenticar chamadas às Edge Functions.';

-- 9. Informações sobre os cron jobs configurados
DO $$
BEGIN
    RAISE NOTICE '==========================================';
    RAISE NOTICE 'CRON JOBS CONFIGURADOS:';
    RAISE NOTICE '==========================================';
    RAISE NOTICE '1. check-pending-orders-every-1min';
    RAISE NOTICE '   - Executa: A cada 1 minuto';
    RAISE NOTICE '   - Função: check-pending-orders';
    RAISE NOTICE '   - Ação: Verifica pedidos pending há mais de 7 minutos e envia primeira mensagem';
    RAISE NOTICE '';
    RAISE NOTICE '2. process-funnel-every-5min';
    RAISE NOTICE '   - Executa: A cada 5 minutos';
    RAISE NOTICE '   - Função: process-funnel';
    RAISE NOTICE '   - Ação: Processa mensagens agendadas do funil (20min, 60min, 720min)';
    RAISE NOTICE '';
    RAISE NOTICE 'INTERVALOS DE MENSAGENS:';
    RAISE NOTICE '- checkout_link: 7 minutos após pedido entrar em pending';
    RAISE NOTICE '- follow_up_1: 20 minutos após pedido entrar em pending';
    RAISE NOTICE '- follow_up_2: 60 minutos (1 hora) após pedido entrar em pending';
    RAISE NOTICE '- follow_up_3: 720 minutos (12 horas) após pedido entrar em pending';
    RAISE NOTICE '==========================================';
END $$;

