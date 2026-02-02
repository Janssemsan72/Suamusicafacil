-- ==========================================
-- Garantir que a função RPC get_dashboard_stats existe
-- ==========================================
-- Esta migração garante que a função RPC esteja disponível
-- mesmo se a migração anterior não foi aplicada
-- ==========================================

CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_total_orders INTEGER;
  v_paid_orders INTEGER;
  v_pending_orders INTEGER;
  v_refunded_orders INTEGER;
  v_stripe_orders INTEGER;
  v_cakto_orders INTEGER;
  v_stripe_revenue NUMERIC;
  v_cakto_revenue NUMERIC;
  v_total_revenue_brl NUMERIC;
  v_total_revenue_usd NUMERIC;
  v_total_revenue_brl_converted NUMERIC;
  v_active_songs INTEGER;
  v_pending_jobs INTEGER;
  v_failed_jobs INTEGER;
  v_usd_to_brl NUMERIC := 5.5;
BEGIN
  -- Contar pedidos por status
  SELECT COUNT(*) INTO v_total_orders FROM orders;
  SELECT COUNT(*) INTO v_paid_orders FROM orders WHERE status = 'paid';
  SELECT COUNT(*) INTO v_pending_orders FROM orders WHERE status = 'pending';
  SELECT COUNT(*) INTO v_refunded_orders FROM orders WHERE status = 'refunded';
  
  -- Contar e calcular receitas por provider
  SELECT 
    COUNT(*) FILTER (WHERE payment_provider = 'stripe' OR provider = 'stripe'),
    COUNT(*) FILTER (WHERE payment_provider != 'stripe' AND (provider IS NULL OR provider != 'stripe')),
    COALESCE(SUM(amount_cents) FILTER (WHERE payment_provider = 'stripe' OR provider = 'stripe'), 0) / 100.0,
    COALESCE(SUM(amount_cents) FILTER (WHERE payment_provider != 'stripe' AND (provider IS NULL OR provider != 'stripe')), 0) / 100.0
  INTO v_stripe_orders, v_cakto_orders, v_stripe_revenue, v_cakto_revenue
  FROM orders
  WHERE status = 'paid';
  
  -- Calcular receitas totais
  v_total_revenue_usd := COALESCE(v_stripe_revenue, 0);
  v_total_revenue_brl := COALESCE(v_cakto_revenue, 0);
  v_total_revenue_brl_converted := v_total_revenue_brl + (v_total_revenue_usd * v_usd_to_brl);
  
  -- Contar músicas e jobs
  SELECT COUNT(*) INTO v_active_songs FROM songs WHERE status = 'released';
  SELECT COUNT(*) INTO v_pending_jobs FROM jobs WHERE status = 'pending';
  SELECT COUNT(*) INTO v_failed_jobs FROM jobs WHERE status = 'failed';
  
  -- Construir resultado JSON
  v_result := jsonb_build_object(
    'totalOrders', v_total_orders,
    'paidOrders', v_paid_orders,
    'pendingOrders', v_pending_orders,
    'refundedOrders', v_refunded_orders,
    'stripeOrders', v_stripe_orders,
    'caktoOrders', v_cakto_orders,
    'stripeRevenue', v_stripe_revenue,
    'caktoRevenue', v_cakto_revenue,
    'totalRevenueUSD', v_total_revenue_usd,
    'totalRevenueBRL', v_total_revenue_brl,
    'totalRevenueBRLConverted', v_total_revenue_brl_converted,
    'activeSongs', v_active_songs,
    'pendingJobs', v_pending_jobs,
    'failedJobs', v_failed_jobs
  );
  
  RETURN v_result;
END;
$$;

-- Comentário
COMMENT ON FUNCTION get_dashboard_stats() IS 
'Função RPC para calcular estatísticas do dashboard admin usando SQL agregado. Retorna todas as estatísticas necessárias em uma única chamada, evitando buscar todos os pedidos no frontend.';

-- Garantir permissões
GRANT EXECUTE ON FUNCTION get_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_stats() TO anon;

