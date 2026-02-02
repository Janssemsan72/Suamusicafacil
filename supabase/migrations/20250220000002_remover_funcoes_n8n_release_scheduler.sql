-- ==========================================
-- REMOVER FUNÇÕES E CRON JOBS
-- Remove funções n8n-webhook, release-scheduler e release-songs
-- Remove cron jobs relacionados
-- ==========================================

-- 1. Remover cron jobs relacionados a release-scheduler e release-songs
DO $$ 
DECLARE
    job_record RECORD;
BEGIN
    -- Remover todos os jobs relacionados
    FOR job_record IN 
        SELECT jobname FROM cron.job 
        WHERE jobname LIKE '%scheduled-releases%' 
           OR jobname LIKE '%release-songs%'
           OR jobname LIKE '%release-scheduler%'
           OR jobname LIKE '%n8n%'
    LOOP
        BEGIN
            PERFORM cron.unschedule(job_record.jobname);
            RAISE NOTICE '✅ Removido cron job: %', job_record.jobname;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE WARNING '⚠️ Não foi possível remover cron job %: %', job_record.jobname, SQLERRM;
        END;
    END LOOP;
END $$;

-- 2. Verificar se há mais cron jobs relacionados
SELECT 
  '🔍 Verificação Cron Jobs' as passo,
  jobname,
  schedule,
  active,
  CASE 
    WHEN active THEN '⚠️ ATIVO - Precisa ser removido manualmente'
    ELSE '✅ INATIVO'
  END as status
FROM cron.job 
WHERE jobname LIKE '%scheduled-releases%' 
   OR jobname LIKE '%release-songs%'
   OR jobname LIKE '%release-scheduler%'
   OR jobname LIKE '%n8n%';

-- 3. Verificar se as funções ainda existem no Supabase (serão removidas via dashboard ou CLI)
SELECT 
  '🔍 Verificação Edge Functions' as passo,
  slug,
  status,
  version,
  CASE 
    WHEN slug IN ('n8n-webhook', 'release-scheduler', 'release-songs') THEN '⚠️ Ainda existe - Remover via Dashboard'
    ELSE '✅ OK'
  END as acao
FROM pg_net.http_request_queue
WHERE false; -- Esta query não funciona, mas serve como placeholder

SELECT '🎉 Migration concluída! Remova as Edge Functions manualmente via Supabase Dashboard se necessário.' as resultado;

