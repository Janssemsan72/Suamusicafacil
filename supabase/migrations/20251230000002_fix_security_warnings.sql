-- ==========================================
-- CORREÇÃO DE SEGURANÇA: RLS e Views
-- ==========================================

-- 1. Corrigir View orders_at_risk (Remover SECURITY DEFINER)
DROP VIEW IF EXISTS public.orders_at_risk;
CREATE VIEW public.orders_at_risk AS
 SELECT q.id AS quiz_id,
    q.session_id,
    q.customer_email,
    q.customer_whatsapp,
    q.created_at AS quiz_created_at,
    ocl.id AS log_id,
    ocl.status AS log_status,
    ocl.error_message,
    ocl.created_at AS log_created_at
   FROM quizzes q
     LEFT JOIN orders o ON o.quiz_id = q.id
     LEFT JOIN order_creation_logs ocl ON ocl.quiz_id = q.id
  WHERE o.id IS NULL AND q.created_at > (now() - '7 days'::interval)
  ORDER BY q.created_at DESC;

-- 2. Habilitar RLS em tabelas públicas
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_creation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cakto_webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stem_separations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_retry_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cakto_webhooks ENABLE ROW LEVEL SECURITY;

-- 3. Criar Políticas de Segurança (Policies) - Com DROP IF EXISTS para idempotência

-- A. Stem Separations
DROP POLICY IF EXISTS "Users can view own stems" ON public.stem_separations;
CREATE POLICY "Users can view own stems" ON public.stem_separations
  FOR SELECT
  USING (
    song_id IN (
      SELECT s.id 
      FROM public.songs s
      JOIN public.orders o ON s.order_id = o.id
      WHERE o.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins have full access to stem_separations" ON public.stem_separations;
CREATE POLICY "Admins have full access to stem_separations" ON public.stem_separations
  FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

-- B. Políticas para Logs e Filas (Admins)

-- email_queue
DROP POLICY IF EXISTS "Admins have full access to email_queue" ON public.email_queue;
CREATE POLICY "Admins have full access to email_queue" ON public.email_queue
  FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

-- order_creation_logs
DROP POLICY IF EXISTS "Admins have full access to order_creation_logs" ON public.order_creation_logs;
CREATE POLICY "Admins have full access to order_creation_logs" ON public.order_creation_logs
  FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

-- cakto_webhook_logs
DROP POLICY IF EXISTS "Admins have full access to cakto_webhook_logs" ON public.cakto_webhook_logs;
CREATE POLICY "Admins have full access to cakto_webhook_logs" ON public.cakto_webhook_logs
  FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

-- quiz_retry_queue
DROP POLICY IF EXISTS "Admins have full access to quiz_retry_queue" ON public.quiz_retry_queue;
CREATE POLICY "Admins have full access to quiz_retry_queue" ON public.quiz_retry_queue
  FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

-- quiz_metrics
DROP POLICY IF EXISTS "Admins have full access to quiz_metrics" ON public.quiz_metrics;
CREATE POLICY "Admins have full access to quiz_metrics" ON public.quiz_metrics
  FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

-- cakto_webhooks
DROP POLICY IF EXISTS "Admins have full access to cakto_webhooks" ON public.cakto_webhooks;
CREATE POLICY "Admins have full access to cakto_webhooks" ON public.cakto_webhooks
  FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));
