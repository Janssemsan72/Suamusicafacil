-- ==========================================
-- RLS POLICIES PARA GESTÃO FINANCEIRA
-- ==========================================
-- Políticas de segurança: Admin pode tudo, colaborador pode visualizar se autorizado
-- ==========================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE financial_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE variable_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE pix_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE paid_traffic ENABLE ROW LEVEL SECURITY;
ALTER TABLE cakto_sales_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_financial_summary ENABLE ROW LEVEL SECURITY;

-- Função helper para verificar se é admin
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_roles
    WHERE user_roles.user_id = is_admin.user_id
      AND user_roles.role = 'admin'
  );
END;
$$;

-- Função helper para verificar permissão financeira
CREATE OR REPLACE FUNCTION has_financial_permission(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Admin sempre tem permissão
  IF is_admin(user_id) THEN
    RETURN true;
  END IF;
  
  -- Verificar se colaborador tem permissão
  RETURN EXISTS (
    SELECT 1
    FROM collaborator_permissions
    WHERE collaborator_permissions.user_id = has_financial_permission.user_id
      AND collaborator_permissions.permission_key = 'financial_management'
      AND collaborator_permissions.granted = true
  );
END;
$$;

-- ==========================================
-- POLICIES: financial_categories
-- ==========================================
-- SELECT: Admin ou colaborador com permissão
CREATE POLICY "financial_categories_select"
  ON financial_categories
  FOR SELECT
  USING (has_financial_permission(auth.uid()));

-- INSERT/UPDATE/DELETE: Apenas admin
CREATE POLICY "financial_categories_insert"
  ON financial_categories
  FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "financial_categories_update"
  ON financial_categories
  FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "financial_categories_delete"
  ON financial_categories
  FOR DELETE
  USING (is_admin(auth.uid()));

-- ==========================================
-- POLICIES: fixed_costs
-- ==========================================
CREATE POLICY "fixed_costs_select"
  ON fixed_costs
  FOR SELECT
  USING (has_financial_permission(auth.uid()));

CREATE POLICY "fixed_costs_insert"
  ON fixed_costs
  FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "fixed_costs_update"
  ON fixed_costs
  FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "fixed_costs_delete"
  ON fixed_costs
  FOR DELETE
  USING (is_admin(auth.uid()));

-- ==========================================
-- POLICIES: variable_costs
-- ==========================================
CREATE POLICY "variable_costs_select"
  ON variable_costs
  FOR SELECT
  USING (has_financial_permission(auth.uid()));

CREATE POLICY "variable_costs_insert"
  ON variable_costs
  FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "variable_costs_update"
  ON variable_costs
  FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "variable_costs_delete"
  ON variable_costs
  FOR DELETE
  USING (is_admin(auth.uid()));

-- ==========================================
-- POLICIES: api_costs
-- ==========================================
CREATE POLICY "api_costs_select"
  ON api_costs
  FOR SELECT
  USING (has_financial_permission(auth.uid()));

CREATE POLICY "api_costs_insert"
  ON api_costs
  FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "api_costs_update"
  ON api_costs
  FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "api_costs_delete"
  ON api_costs
  FOR DELETE
  USING (is_admin(auth.uid()));

-- ==========================================
-- POLICIES: refunds
-- ==========================================
CREATE POLICY "refunds_select"
  ON refunds
  FOR SELECT
  USING (has_financial_permission(auth.uid()));

CREATE POLICY "refunds_insert"
  ON refunds
  FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "refunds_update"
  ON refunds
  FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "refunds_delete"
  ON refunds
  FOR DELETE
  USING (is_admin(auth.uid()));

-- ==========================================
-- POLICIES: pix_sales
-- ==========================================
CREATE POLICY "pix_sales_select"
  ON pix_sales
  FOR SELECT
  USING (has_financial_permission(auth.uid()));

CREATE POLICY "pix_sales_insert"
  ON pix_sales
  FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "pix_sales_update"
  ON pix_sales
  FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "pix_sales_delete"
  ON pix_sales
  FOR DELETE
  USING (is_admin(auth.uid()));

-- ==========================================
-- POLICIES: adjustments
-- ==========================================
CREATE POLICY "adjustments_select"
  ON adjustments
  FOR SELECT
  USING (has_financial_permission(auth.uid()));

CREATE POLICY "adjustments_insert"
  ON adjustments
  FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "adjustments_update"
  ON adjustments
  FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "adjustments_delete"
  ON adjustments
  FOR DELETE
  USING (is_admin(auth.uid()));

-- ==========================================
-- POLICIES: paid_traffic
-- ==========================================
CREATE POLICY "paid_traffic_select"
  ON paid_traffic
  FOR SELECT
  USING (has_financial_permission(auth.uid()));

CREATE POLICY "paid_traffic_insert"
  ON paid_traffic
  FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "paid_traffic_update"
  ON paid_traffic
  FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "paid_traffic_delete"
  ON paid_traffic
  FOR DELETE
  USING (is_admin(auth.uid()));

-- ==========================================
-- POLICIES: cakto_sales_summary
-- ==========================================
CREATE POLICY "cakto_sales_summary_select"
  ON cakto_sales_summary
  FOR SELECT
  USING (has_financial_permission(auth.uid()));

CREATE POLICY "cakto_sales_summary_insert"
  ON cakto_sales_summary
  FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "cakto_sales_summary_update"
  ON cakto_sales_summary
  FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "cakto_sales_summary_delete"
  ON cakto_sales_summary
  FOR DELETE
  USING (is_admin(auth.uid()));

-- ==========================================
-- POLICIES: daily_financial_summary
-- ==========================================
CREATE POLICY "daily_financial_summary_select"
  ON daily_financial_summary
  FOR SELECT
  USING (has_financial_permission(auth.uid()));

-- Apenas sistema pode inserir/atualizar (via triggers)
CREATE POLICY "daily_financial_summary_insert"
  ON daily_financial_summary
  FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "daily_financial_summary_update"
  ON daily_financial_summary
  FOR UPDATE
  USING (is_admin(auth.uid()));

-- Comentários
COMMENT ON FUNCTION is_admin(UUID) IS 'Verifica se o usuário é admin';
COMMENT ON FUNCTION has_financial_permission(UUID) IS 'Verifica se o usuário tem permissão para visualizar dados financeiros (admin ou colaborador com permissão)';


