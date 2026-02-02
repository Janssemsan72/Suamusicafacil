-- ==========================================
-- Remover Cron Job check-payments (função não existe mais)
-- ==========================================

-- Remover job existente
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
            RAISE NOTICE '✅ Removido job: %', job_record.jobname;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE WARNING '⚠️ Não foi possível remover job %: %', job_record.jobname, SQLERRM;
        END;
    END LOOP;
END $$;

-- Verificar se foi removido
SELECT 
  jobname, 
  schedule, 
  active,
  jobid
FROM cron.job 
WHERE jobname LIKE '%check-payments%';








