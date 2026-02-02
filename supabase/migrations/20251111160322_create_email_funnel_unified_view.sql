-- ==========================================
-- Criar View Unificada para Email Funnel
-- Similar a whatsapp_funnel_unified
-- ==========================================

CREATE OR REPLACE VIEW email_funnel_unified AS
SELECT 
  id, order_id, customer_email,
  'pending' as source_table,
  current_step, last_email_sent_at, next_email_at,
  ab_variant, exit_reason, created_at, updated_at,
  order_status, order_amount_cents, order_created_at,
  order_plan, quiz_id, quiz_about_who,
  is_paused
FROM email_funnel_pending
UNION ALL
SELECT 
  id, order_id, customer_email,
  'completed' as source_table,
  current_step, last_email_sent_at, next_email_at,
  ab_variant, exit_reason, created_at, updated_at,
  order_status, order_amount_cents, order_created_at,
  order_plan, quiz_id, quiz_about_who,
  is_paused
FROM email_funnel_completed
UNION ALL
SELECT 
  id, order_id, customer_email,
  'exited' as source_table,
  current_step, last_email_sent_at, next_email_at,
  ab_variant, exit_reason, created_at, updated_at,
  order_status, order_amount_cents, order_created_at,
  order_plan, quiz_id, quiz_about_who,
  is_paused
FROM email_funnel_exited;

-- Comentário
COMMENT ON VIEW email_funnel_unified IS 'View unificada que combina as 3 tabelas de funil de email (pending, completed, exited)';

