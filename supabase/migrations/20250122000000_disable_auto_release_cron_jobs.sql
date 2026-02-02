-- ==========================================
-- DESABILITAR CRON JOBS DE LIBERAÇÃO AUTOMÁTICA
-- ==========================================
-- PROBLEMA: Cron jobs estão liberando músicas automaticamente
-- SOLUÇÃO: Desabilitar todos os cron jobs que liberam músicas automaticamente
-- As músicas só devem ser liberadas quando o admin clicar em "Enviar" no painel
-- ==========================================

-- 1. Desabilitar/Remover cron jobs relacionados a releases automáticos
DO $$ 
DECLARE
    job_record RECORD;
    jobs_removed INTEGER := 0;
BEGIN
    RAISE NOTICE '🔍 Procurando cron jobs de liberação automática...';
    
    -- Remover todos os jobs relacionados a releases automáticos
    FOR job_record IN 
        SELECT jobid, jobname FROM cron.job 
        WHERE jobname LIKE '%release%' 
           OR jobname LIKE '%cron_release%'
           OR jobname LIKE '%scheduled-releases%'
           OR jobname LIKE '%release-songs%'
           OR jobname LIKE '%release-scheduler%'
    LOOP
        BEGIN
            -- Tentar remover o job
            PERFORM cron.unschedule(job_record.jobname);
            jobs_removed := jobs_removed + 1;
            RAISE NOTICE '✅ Removido cron job: % (ID: %)', job_record.jobname, job_record.jobid;
        EXCEPTION
            WHEN OTHERS THEN
                -- Se não conseguir remover, tentar desabilitar
                BEGIN
                    UPDATE cron.job 
                    SET active = false 
                    WHERE jobid = job_record.jobid;
                    jobs_removed := jobs_removed + 1;
                    RAISE NOTICE '⚠️ Desabilitado cron job: % (ID: %) - Não foi possível remover', job_record.jobname, job_record.jobid;
                EXCEPTION
                    WHEN OTHERS THEN
                        RAISE WARNING '❌ Não foi possível remover ou desabilitar cron job % (ID: %): %', job_record.jobname, job_record.jobid, SQLERRM;
                END;
        END;
    END LOOP;
    
    IF jobs_removed = 0 THEN
        RAISE NOTICE 'ℹ️ Nenhum cron job de liberação automática encontrado';
    ELSE
        RAISE NOTICE '✅ Total de cron jobs removidos/desabilitados: %', jobs_removed;
    END IF;
END $$;

-- 2. Verificar se ainda há cron jobs ativos relacionados a releases
SELECT 
  '🔍 Verificação Final' as passo,
  jobid,
  jobname,
  schedule,
  active,
  CASE 
    WHEN active THEN '⚠️ ATIVO - Precisa ser removido manualmente'
    ELSE '✅ DESABILITADO'
  END as status
FROM cron.job 
WHERE jobname LIKE '%release%' 
   OR jobname LIKE '%cron_release%'
   OR jobname LIKE '%scheduled-releases%'
   OR jobname LIKE '%release-songs%'
   OR jobname LIKE '%release-scheduler%'
ORDER BY active DESC, jobname;

-- 3. Comentário final
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ Migration concluída!';
    RAISE NOTICE '📝 As músicas agora só serão liberadas quando o admin clicar em "Enviar" no painel /admin/releases';
    RAISE NOTICE '⚠️ Se ainda houver cron jobs ativos listados acima, remova-os manualmente via:';
    RAISE NOTICE '   SELECT cron.unschedule(''nome_do_job'');';
END $$;





