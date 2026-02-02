-- Performance: Drop synchronous triggers for metrics if they exist
DROP TRIGGER IF EXISTS quiz_insert_metrics_trigger ON quizzes;
DROP FUNCTION IF EXISTS trigger_update_quiz_metrics_on_quiz_insert();

DROP TRIGGER IF EXISTS order_insert_metrics_trigger ON orders;
DROP FUNCTION IF EXISTS trigger_update_quiz_metrics_on_order_insert();

DROP TRIGGER IF EXISTS order_update_metrics_trigger ON orders;
DROP FUNCTION IF EXISTS trigger_update_quiz_metrics_on_order_update();

-- Performance: Add index on customer_email if not exists
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);

-- Consistency: Fix inconsistent order states
UPDATE orders 
SET paid_at = created_at 
WHERE status = 'paid' AND paid_at IS NULL;

-- Setup Cron for Metrics (if pg_cron is available)
DO $$
DECLARE
  v_job_id bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Find and unschedule existing job
    SELECT jobid INTO v_job_id
    FROM cron.job
    WHERE jobname = 'update-quiz-metrics-every-15-mins';
    
    IF v_job_id IS NOT NULL THEN
      PERFORM cron.unschedule(v_job_id);
    END IF;

    -- Schedule the metrics update every 15 minutes
    PERFORM cron.schedule(
      'update-quiz-metrics-every-15-mins',
      '*/15 * * * *',
      'SELECT update_quiz_metrics()'
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error configuring cron job: %', SQLERRM;
END $$;
