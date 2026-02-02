-- ==========================================
-- FUNÇÕES DE CÁLCULO FINANCEIRO
-- ==========================================
-- Funções para calcular resumos financeiros diários automaticamente
-- ==========================================

-- Função para calcular custos fixos proporcionais do dia
CREATE OR REPLACE FUNCTION calculate_daily_fixed_costs(p_date DATE)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_cents INTEGER := 0;
  v_cost RECORD;
  v_days_in_month INTEGER;
BEGIN
  -- Buscar custos fixos ativos do mês
  FOR v_cost IN
    SELECT amount_cents, frequency, month, year
    FROM fixed_costs
    WHERE is_active = true
      AND year = EXTRACT(YEAR FROM p_date)
      AND month = EXTRACT(MONTH FROM p_date)
      AND (start_date IS NULL OR start_date <= p_date)
      AND (end_date IS NULL OR end_date >= p_date)
  LOOP
    IF v_cost.frequency = 'monthly' THEN
      -- Dividir custo mensal pelos dias do mês
      v_days_in_month := EXTRACT(DAY FROM (DATE_TRUNC('month', p_date) + INTERVAL '1 month - 1 day'));
      v_total_cents := v_total_cents + (v_cost.amount_cents / v_days_in_month);
    ELSIF v_cost.frequency = 'yearly' THEN
      -- Dividir custo anual pelos dias do ano
      v_total_cents := v_total_cents + (v_cost.amount_cents / 365);
    ELSIF v_cost.frequency = 'weekly' THEN
      -- Dividir custo semanal por 7
      v_total_cents := v_total_cents + (v_cost.amount_cents / 7);
    ELSIF v_cost.frequency = 'daily' THEN
      v_total_cents := v_total_cents + v_cost.amount_cents;
    END IF;
  END LOOP;
  
  RETURN COALESCE(v_total_cents, 0);
END;
$$;

-- Função para calcular resumo financeiro diário
CREATE OR REPLACE FUNCTION calculate_daily_financial_summary(p_date DATE)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_revenue_cents INTEGER := 0;
  v_costs_cents INTEGER := 0;
  v_profit_cents INTEGER := 0;
  v_cakto_sales_cents INTEGER := 0;
  v_pix_sales_cents INTEGER := 0;
  v_adjustments_cents INTEGER := 0;
  v_refunds_cents INTEGER := 0;
  v_fixed_costs_cents INTEGER := 0;
  v_variable_costs_cents INTEGER := 0;
  v_api_costs_cents INTEGER := 0;
  v_traffic_costs_cents INTEGER := 0;
BEGIN
  -- Vendas Cakto (da tabela cakto_sales_summary)
  SELECT COALESCE(net_revenue_cents, 0) INTO v_cakto_sales_cents
  FROM cakto_sales_summary
  WHERE date = p_date;
  
  -- Vendas PIX (apenas pagas)
  SELECT COALESCE(SUM(amount_cents), 0) INTO v_pix_sales_cents
  FROM pix_sales
  WHERE sale_date = p_date AND status = 'paid';
  
  -- Ajustes (apenas pagos)
  SELECT COALESCE(SUM(amount_cents), 0) INTO v_adjustments_cents
  FROM adjustments
  WHERE adjustment_date = p_date AND status = 'paid';
  
  -- Reembolsos (apenas completados)
  SELECT COALESCE(SUM(amount_cents), 0) INTO v_refunds_cents
  FROM refunds
  WHERE refund_date = p_date AND status = 'completed';
  
  -- Custos fixos (proporcionais)
  v_fixed_costs_cents := calculate_daily_fixed_costs(p_date);
  
  -- Custos variáveis
  SELECT COALESCE(SUM(amount_cents), 0) INTO v_variable_costs_cents
  FROM variable_costs
  WHERE date = p_date;
  
  -- Custos de API
  SELECT COALESCE(SUM(amount_cents), 0) INTO v_api_costs_cents
  FROM api_costs
  WHERE date = p_date;
  
  -- Tráfego pago
  SELECT COALESCE(SUM(amount_cents), 0) INTO v_traffic_costs_cents
  FROM paid_traffic
  WHERE date = p_date;
  
  -- Calcular totais
  v_revenue_cents := v_cakto_sales_cents + v_pix_sales_cents + v_adjustments_cents - v_refunds_cents;
  v_costs_cents := v_fixed_costs_cents + v_variable_costs_cents + v_api_costs_cents + v_traffic_costs_cents;
  v_profit_cents := v_revenue_cents - v_costs_cents;
  
  -- Inserir ou atualizar resumo diário
  INSERT INTO daily_financial_summary (
    date,
    revenue_cents,
    costs_cents,
    profit_cents,
    cakto_sales_cents,
    pix_sales_cents,
    adjustments_cents,
    refunds_cents,
    fixed_costs_cents,
    variable_costs_cents,
    api_costs_cents,
    traffic_costs_cents
  ) VALUES (
    p_date,
    v_revenue_cents,
    v_costs_cents,
    v_profit_cents,
    v_cakto_sales_cents,
    v_pix_sales_cents,
    v_adjustments_cents,
    v_refunds_cents,
    v_fixed_costs_cents,
    v_variable_costs_cents,
    v_api_costs_cents,
    v_traffic_costs_cents
  )
  ON CONFLICT (date) DO UPDATE SET
    revenue_cents = EXCLUDED.revenue_cents,
    costs_cents = EXCLUDED.costs_cents,
    profit_cents = EXCLUDED.profit_cents,
    cakto_sales_cents = EXCLUDED.cakto_sales_cents,
    pix_sales_cents = EXCLUDED.pix_sales_cents,
    adjustments_cents = EXCLUDED.adjustments_cents,
    refunds_cents = EXCLUDED.refunds_cents,
    fixed_costs_cents = EXCLUDED.fixed_costs_cents,
    variable_costs_cents = EXCLUDED.variable_costs_cents,
    api_costs_cents = EXCLUDED.api_costs_cents,
    traffic_costs_cents = EXCLUDED.traffic_costs_cents,
    updated_at = NOW();
END;
$$;

-- Função trigger para atualizar resumo quando houver mudanças
CREATE OR REPLACE FUNCTION trigger_update_daily_financial_summary()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_date DATE;
BEGIN
  -- Determinar a data baseado na tabela modificada
  IF TG_TABLE_NAME = 'fixed_costs' THEN
    -- Para custos fixos, atualizar todos os dias do mês
    IF TG_OP = 'DELETE' THEN
      IF OLD.month IS NOT NULL AND OLD.year IS NOT NULL THEN
        v_date := DATE(OLD.year || '-' || LPAD(OLD.month::TEXT, 2, '0') || '-01');
        PERFORM calculate_daily_financial_summary(v_date);
      END IF;
    ELSIF NEW.month IS NOT NULL AND NEW.year IS NOT NULL THEN
      -- Atualizar resumo do primeiro dia do mês (representativo)
      v_date := DATE(NEW.year || '-' || LPAD(NEW.month::TEXT, 2, '0') || '-01');
      PERFORM calculate_daily_financial_summary(v_date);
    END IF;
  ELSIF TG_TABLE_NAME = 'variable_costs' THEN
    v_date := COALESCE(NEW.date, OLD.date);
  ELSIF TG_TABLE_NAME = 'api_costs' THEN
    v_date := COALESCE(NEW.date, OLD.date);
  ELSIF TG_TABLE_NAME = 'pix_sales' THEN
    v_date := COALESCE(NEW.sale_date, OLD.sale_date);
  ELSIF TG_TABLE_NAME = 'adjustments' THEN
    v_date := COALESCE(NEW.adjustment_date, OLD.adjustment_date);
  ELSIF TG_TABLE_NAME = 'refunds' THEN
    v_date := COALESCE(NEW.refund_date, OLD.refund_date);
  ELSIF TG_TABLE_NAME = 'paid_traffic' THEN
    v_date := COALESCE(NEW.date, OLD.date);
  ELSIF TG_TABLE_NAME = 'cakto_sales_summary' THEN
    v_date := COALESCE(NEW.date, OLD.date);
  END IF;
  
  IF v_date IS NOT NULL THEN
    PERFORM calculate_daily_financial_summary(v_date);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Triggers para atualizar resumo diário
CREATE TRIGGER trigger_update_summary_on_fixed_costs_change
  AFTER INSERT OR UPDATE OR DELETE ON fixed_costs
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_daily_financial_summary();

CREATE TRIGGER trigger_update_summary_on_variable_costs_change
  AFTER INSERT OR UPDATE OR DELETE ON variable_costs
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_daily_financial_summary();

CREATE TRIGGER trigger_update_summary_on_api_costs_change
  AFTER INSERT OR UPDATE OR DELETE ON api_costs
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_daily_financial_summary();

CREATE TRIGGER trigger_update_summary_on_pix_sales_change
  AFTER INSERT OR UPDATE OR DELETE ON pix_sales
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_daily_financial_summary();

CREATE TRIGGER trigger_update_summary_on_adjustments_change
  AFTER INSERT OR UPDATE OR DELETE ON adjustments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_daily_financial_summary();

CREATE TRIGGER trigger_update_summary_on_refunds_change
  AFTER INSERT OR UPDATE OR DELETE ON refunds
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_daily_financial_summary();

CREATE TRIGGER trigger_update_summary_on_paid_traffic_change
  AFTER INSERT OR UPDATE OR DELETE ON paid_traffic
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_daily_financial_summary();

CREATE TRIGGER trigger_update_summary_on_cakto_sales_change
  AFTER INSERT OR UPDATE OR DELETE ON cakto_sales_summary
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_daily_financial_summary();

-- Comentários
COMMENT ON FUNCTION calculate_daily_fixed_costs(DATE) IS 
'Calcula custos fixos proporcionais para um dia específico, dividindo custos mensais/anuais pelos dias do período';

COMMENT ON FUNCTION calculate_daily_financial_summary(DATE) IS 
'Calcula e atualiza o resumo financeiro diário para uma data específica, somando todas as receitas e custos';

COMMENT ON FUNCTION trigger_update_daily_financial_summary() IS 
'Trigger function que atualiza o resumo financeiro diário quando há mudanças nas tabelas financeiras';

