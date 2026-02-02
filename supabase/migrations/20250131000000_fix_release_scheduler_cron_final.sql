-- ==========================================
-- CORREÇÃO FINAL: Cron Job para Release Scheduler
-- Configura cron job para enviar emails agendados
-- ==========================================

-- 1. Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Remover TODOS os jobs existentes que possam conflitar
DO $$ 
DECLARE
    job_record RECORD;
BEGIN
    -- Remover jobs antigos
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

-- 3. Obter Service Role Key do Vault
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
        WHERE name = 'service_role_key'
        LIMIT 1;
        
        -- Se não encontrou no vault, usar o valor direto do projeto
        IF service_role_key IS NULL THEN
            -- Este valor deve ser substituído pela chave real do Supabase Dashboard
            -- Para obter: Supabase Dashboard > Settings > API > service_role key
            RAISE NOTICE 'Service role não encontrado no vault. Você precisa atualizar este valor!';
            service_role_key := 'SERVICE_ROLE_KEY_AQUI'; -- ATUALIZAR COM A CHAVE REAL
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Erro ao buscar service_role do vault: %', SQLERRM;
            -- Fallback: valor direto (DEVE SER ATUALIZADO)
            service_role_key := 'SERVICE_ROLE_KEY_AQUI'; -- ATUALIZAR COM A CHAVE REAL
    END;

    -- URL da função
    function_url := 'https://' || project_ref || '.supabase.co/functions/v1/release-scheduler';

    -- 4. Criar cron job para release-scheduler (a cada 5 minutos)
    BEGIN
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
        
        RAISE NOTICE '✅ Cron job release-scheduler-every-5min criado com sucesso';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'Erro ao criar cron job: %', SQLERRM;
    END;
END $$;

-- 5. Verificar se o job foi criado corretamente
SELECT 
  jobname, 
  schedule, 
  active,
  jobid,
  CASE 
    WHEN active THEN '✅ ATIVO'
    ELSE '❌ INATIVO'
  END as status
FROM cron.job 
WHERE jobname = 'release-scheduler-every-5min';

-- 6. NOTA IMPORTANTE:
-- ⚠️ ATENÇÃO: Você precisa atualizar o SERVICE_ROLE_KEY no código acima!
-- 
-- Para obter a chave:
-- 1. Acesse: Supabase Dashboard > Project Settings > API
-- 2. Copie a "service_role" key (secreta)
-- 3. Substitua 'SERVICE_ROLE_KEY_AQUI' pelo valor real
-- 
-- OU configure no Vault:
-- 1. Supabase Dashboard > Project Settings > Vault
-- 2. Adicione secret: name = 'service_role_key', value = '[sua chave]'
-- 3. Execute esta migração novamente

