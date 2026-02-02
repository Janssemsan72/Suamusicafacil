-- ==========================================
-- SISTEMA DE GESTÃO FINANCEIRA
-- ==========================================
-- Criação de todas as tabelas para gestão financeira completa
-- ==========================================

-- 1. ENUMS
-- ==========================================
CREATE TYPE financial_category_type AS ENUM (
  'fixed_cost', 
  'variable_cost', 
  'revenue', 
  'marketing', 
  'operational', 
  'api_cost'
);

CREATE TYPE cost_frequency AS ENUM (
  'monthly', 
  'yearly', 
  'weekly', 
  'daily'
);

CREATE TYPE refund_status AS ENUM (
  'pending', 
  'completed', 
  'failed'
);

CREATE TYPE sale_status AS ENUM (
  'pending', 
  'paid', 
  'cancelled'
);

CREATE TYPE adjustment_status AS ENUM (
  'pending', 
  'paid', 
  'cancelled'
);

-- 2. TABELA: financial_categories
-- ==========================================
CREATE TABLE IF NOT EXISTS financial_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type financial_category_type NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABELA: fixed_costs
-- ==========================================
CREATE TABLE IF NOT EXISTS fixed_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES financial_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  frequency cost_frequency NOT NULL DEFAULT 'monthly',
  month INTEGER CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABELA: variable_costs
-- ==========================================
CREATE TABLE IF NOT EXISTS variable_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES financial_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  receipt_url TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABELA: api_costs
-- ==========================================
CREATE TABLE IF NOT EXISTS api_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  credits_used INTEGER,
  date DATE NOT NULL,
  description TEXT,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABELA: refunds
-- ==========================================
CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  amount_cents INTEGER NOT NULL,
  reason TEXT,
  refund_date DATE NOT NULL,
  status refund_status NOT NULL DEFAULT 'pending',
  provider TEXT NOT NULL,
  transaction_id TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TABELA: pix_sales
-- ==========================================
CREATE TABLE IF NOT EXISTS pix_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_whatsapp TEXT,
  amount_cents INTEGER NOT NULL,
  sale_date DATE NOT NULL,
  payment_date DATE,
  status sale_status NOT NULL DEFAULT 'pending',
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  notes TEXT,
  receipt_url TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. TABELA: adjustments
-- ==========================================
CREATE TABLE IF NOT EXISTS adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  amount_cents INTEGER NOT NULL,
  description TEXT,
  adjustment_date DATE NOT NULL,
  status adjustment_status NOT NULL DEFAULT 'pending',
  payment_method TEXT NOT NULL,
  transaction_id TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. TABELA: paid_traffic
-- ==========================================
CREATE TABLE IF NOT EXISTS paid_traffic (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,
  campaign_name TEXT,
  amount_cents INTEGER NOT NULL,
  date DATE NOT NULL,
  impressions INTEGER,
  clicks INTEGER,
  conversions INTEGER,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. TABELA: cakto_sales_summary
-- ==========================================
-- Registro manual de vendas Cakto com quantidade, valor do produto e taxa
CREATE TABLE IF NOT EXISTS cakto_sales_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  quantity INTEGER NOT NULL DEFAULT 0,
  product_value_cents INTEGER NOT NULL,
  fee_cents INTEGER NOT NULL,
  total_sales_cents INTEGER NOT NULL GENERATED ALWAYS AS (product_value_cents * quantity) STORED,
  total_fees_cents INTEGER NOT NULL GENERATED ALWAYS AS (fee_cents * quantity) STORED,
  net_revenue_cents INTEGER NOT NULL GENERATED ALWAYS AS ((product_value_cents - fee_cents) * quantity) STORED,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. TABELA: daily_financial_summary
-- ==========================================
CREATE TABLE IF NOT EXISTS daily_financial_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  revenue_cents INTEGER NOT NULL DEFAULT 0,
  costs_cents INTEGER NOT NULL DEFAULT 0,
  profit_cents INTEGER NOT NULL DEFAULT 0,
  cakto_sales_cents INTEGER NOT NULL DEFAULT 0,
  pix_sales_cents INTEGER NOT NULL DEFAULT 0,
  adjustments_cents INTEGER NOT NULL DEFAULT 0,
  refunds_cents INTEGER NOT NULL DEFAULT 0,
  fixed_costs_cents INTEGER NOT NULL DEFAULT 0,
  variable_costs_cents INTEGER NOT NULL DEFAULT 0,
  api_costs_cents INTEGER NOT NULL DEFAULT 0,
  traffic_costs_cents INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. ÍNDICES
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_fixed_costs_month_year ON fixed_costs(year, month);
CREATE INDEX IF NOT EXISTS idx_fixed_costs_category ON fixed_costs(category_id);
CREATE INDEX IF NOT EXISTS idx_variable_costs_date ON variable_costs(date);
CREATE INDEX IF NOT EXISTS idx_variable_costs_category ON variable_costs(category_id);
CREATE INDEX IF NOT EXISTS idx_api_costs_date ON api_costs(date);
CREATE INDEX IF NOT EXISTS idx_api_costs_provider ON api_costs(provider);
CREATE INDEX IF NOT EXISTS idx_refunds_order ON refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_date ON refunds(refund_date);
CREATE INDEX IF NOT EXISTS idx_pix_sales_date ON pix_sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_pix_sales_status ON pix_sales(status);
CREATE INDEX IF NOT EXISTS idx_adjustments_order ON adjustments(order_id);
CREATE INDEX IF NOT EXISTS idx_adjustments_date ON adjustments(adjustment_date);
CREATE INDEX IF NOT EXISTS idx_paid_traffic_date ON paid_traffic(date);
CREATE INDEX IF NOT EXISTS idx_paid_traffic_platform ON paid_traffic(platform);
CREATE INDEX IF NOT EXISTS idx_cakto_sales_date ON cakto_sales_summary(date);
CREATE INDEX IF NOT EXISTS idx_daily_summary_date ON daily_financial_summary(date);

-- 13. FUNÇÕES DE ATUALIZAÇÃO
-- ==========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_financial_categories_updated_at
  BEFORE UPDATE ON financial_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fixed_costs_updated_at
  BEFORE UPDATE ON fixed_costs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_variable_costs_updated_at
  BEFORE UPDATE ON variable_costs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_costs_updated_at
  BEFORE UPDATE ON api_costs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_refunds_updated_at
  BEFORE UPDATE ON refunds
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pix_sales_updated_at
  BEFORE UPDATE ON pix_sales
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_adjustments_updated_at
  BEFORE UPDATE ON adjustments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_paid_traffic_updated_at
  BEFORE UPDATE ON paid_traffic
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cakto_sales_updated_at
  BEFORE UPDATE ON cakto_sales_summary
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_summary_updated_at
  BEFORE UPDATE ON daily_financial_summary
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 14. COMENTÁRIOS
-- ==========================================
COMMENT ON TABLE financial_categories IS 'Categorias de custos e receitas para organização';
COMMENT ON TABLE fixed_costs IS 'Custos fixos recorrentes (hospedagem, Resend, etc.) - valores podem variar mês a mês';
COMMENT ON TABLE variable_costs IS 'Custos variáveis pontuais';
COMMENT ON TABLE api_costs IS 'Despesas com APIs (Suno, OpenAI, etc.) - registro diário';
COMMENT ON TABLE refunds IS 'Reembolsos de pedidos';
COMMENT ON TABLE pix_sales IS 'Vendas por PIX em outros locais (preços diferentes)';
COMMENT ON TABLE adjustments IS 'Ajustes cobrados aos clientes';
COMMENT ON TABLE paid_traffic IS 'Tráfego pago diário (anúncios, marketing)';
COMMENT ON TABLE cakto_sales_summary IS 'Resumo de vendas Cakto por dia - registro manual com quantidade, valor do produto e taxa';
COMMENT ON TABLE daily_financial_summary IS 'Resumo financeiro diário (calculado automaticamente)';


