-- ==========================================
-- Query de Monitoramento: Pedidos 'paid' sem Indicadores Válidos
-- ==========================================
-- Esta query identifica pedidos marcados como 'paid' mas que não têm
-- indicadores válidos de pagamento confirmado (cakto_transaction_id ou stripe_payment_intent_id)
-- 
-- Uso: Execute esta query periodicamente para monitorar inconsistências
-- ==========================================

-- Query 1: Pedidos 'paid' sem indicadores válidos de pagamento
SELECT 
  o.id,
  o.customer_email,
  o.status,
  o.paid_at,
  o.created_at,
  o.cakto_transaction_id,
  o.cakto_payment_status,
  o.stripe_payment_intent_id,
  o.stripe_checkout_session_id,
  o.provider,
  o.payment_provider,
  -- Verificar se tem email enviado
  EXISTS (
    SELECT 1 
    FROM email_logs el 
    WHERE el.order_id = o.id 
      AND el.email_type = 'order_paid' 
      AND el.status IN ('sent', 'delivered')
  ) as tem_email_enviado,
  -- Data do email enviado (se houver)
  (
    SELECT MAX(sent_at) 
    FROM email_logs el 
    WHERE el.order_id = o.id 
      AND el.email_type = 'order_paid' 
      AND el.status IN ('sent', 'delivered')
  ) as email_enviado_em
FROM orders o
WHERE o.status = 'paid'
  -- Não tem indicadores válidos de Cakto
  AND NOT (
    o.cakto_transaction_id IS NOT NULL 
    AND o.cakto_transaction_id != '' 
    AND o.cakto_payment_status IN ('approved', 'paid', 'pago', 'aprovada')
  )
  -- E não tem indicadores válidos de Stripe
  AND NOT (
    o.stripe_payment_intent_id IS NOT NULL 
    AND o.stripe_payment_intent_id != ''
  )
ORDER BY o.created_at DESC;

-- Query 2: Resumo estatístico
SELECT 
  COUNT(*) as total_pedidos_paid_sem_indicadores,
  COUNT(DISTINCT customer_email) as emails_unicos,
  COUNT(*) FILTER (WHERE paid_at IS NOT NULL) as com_paid_at,
  COUNT(*) FILTER (WHERE paid_at IS NULL) as sem_paid_at,
  COUNT(*) FILTER (
    WHERE EXISTS (
      SELECT 1 
      FROM email_logs el 
      WHERE el.order_id = orders.id 
        AND el.email_type = 'order_paid' 
        AND el.status IN ('sent', 'delivered')
    )
  ) as com_email_enviado,
  COUNT(*) FILTER (
    WHERE NOT EXISTS (
      SELECT 1 
      FROM email_logs el 
      WHERE el.order_id = orders.id 
        AND el.email_type = 'order_paid' 
        AND el.status IN ('sent', 'delivered')
    )
  ) as sem_email_enviado
FROM orders
WHERE status = 'paid'
  -- Não tem indicadores válidos de Cakto
  AND NOT (
    cakto_transaction_id IS NOT NULL 
    AND cakto_transaction_id != '' 
    AND cakto_payment_status IN ('approved', 'paid', 'pago', 'aprovada')
  )
  -- E não tem indicadores válidos de Stripe
  AND NOT (
    stripe_payment_intent_id IS NOT NULL 
    AND stripe_payment_intent_id != ''
  );

-- Query 3: Emails enviados para pedidos sem indicadores válidos (PROBLEMA CRÍTICO)
SELECT 
  o.id as order_id,
  o.customer_email,
  o.status,
  o.paid_at,
  o.created_at,
  o.cakto_transaction_id,
  o.cakto_payment_status,
  o.stripe_payment_intent_id,
  el.id as email_log_id,
  el.sent_at as email_enviado_em,
  el.status as email_status,
  el.email_type
FROM orders o
INNER JOIN email_logs el ON el.order_id = o.id
WHERE o.status = 'paid'
  AND el.email_type = 'order_paid'
  AND el.status IN ('sent', 'delivered')
  -- Não tem indicadores válidos de Cakto
  AND NOT (
    o.cakto_transaction_id IS NOT NULL 
    AND o.cakto_transaction_id != '' 
    AND o.cakto_payment_status IN ('approved', 'paid', 'pago', 'aprovada')
  )
  -- E não tem indicadores válidos de Stripe
  AND NOT (
    o.stripe_payment_intent_id IS NOT NULL 
    AND o.stripe_payment_intent_id != ''
  )
ORDER BY el.sent_at DESC;

-- Query 4: Logs de auditoria de bloqueios (após implementação da validação)
SELECT 
  id,
  action,
  target_id as order_id,
  changes->>'reason' as motivo_bloqueio,
  changes->>'status' as order_status,
  changes->>'cakto_transaction_id' as cakto_transaction_id,
  changes->>'cakto_payment_status' as cakto_payment_status,
  changes->>'stripe_payment_intent_id' as stripe_payment_intent_id,
  created_at
FROM admin_logs
WHERE action = 'email_blocked_no_payment_indicator'
ORDER BY created_at DESC
LIMIT 100;









