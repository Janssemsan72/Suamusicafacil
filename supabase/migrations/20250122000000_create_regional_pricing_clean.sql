-- ==========================================
-- Sistema de Preços Regionalizados - LIMPO
-- ==========================================

-- 1. TABELA: user_sessions
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address_hash TEXT,
  detected_country TEXT NOT NULL,
  detected_region TEXT NOT NULL,
  locked_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
  session_token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_country CHECK (detected_country IN ('BR', 'US', 'ES', 'MX', 'AR', 'CO', 'CL', 'PE', 'OTHER')),
  CONSTRAINT valid_region CHECK (detected_region IN ('brasil', 'usa', 'internacional'))
);

-- 2. TABELA: pricing_plans
CREATE TABLE IF NOT EXISTS pricing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  stripe_price_id TEXT NOT NULL,
  features JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_region_plan UNIQUE(region, plan_name),
  CONSTRAINT valid_currency CHECK (currency IN ('BRL', 'USD', 'EUR')),
  CONSTRAINT positive_price CHECK (price_cents > 0)
);

-- 3. ÍNDICES para performance
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_country ON user_sessions(detected_country);
CREATE INDEX IF NOT EXISTS idx_user_sessions_region ON user_sessions(detected_region);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_pricing_plans_region ON pricing_plans(region);
CREATE INDEX IF NOT EXISTS idx_pricing_plans_active ON pricing_plans(is_active);

-- 4. RLS (Row Level Security)
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_plans ENABLE ROW LEVEL SECURITY;

-- Políticas para user_sessions
DROP POLICY IF EXISTS "Service role can manage user sessions" ON user_sessions;
CREATE POLICY "Service role can manage user sessions"
  ON user_sessions FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users can view their own sessions" ON user_sessions;
CREATE POLICY "Users can view their own sessions"
  ON user_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- Políticas para pricing_plans
DROP POLICY IF EXISTS "Anyone can view active pricing plans" ON pricing_plans;
CREATE POLICY "Anyone can view active pricing plans"
  ON pricing_plans FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Service role can manage pricing plans" ON pricing_plans;
CREATE POLICY "Service role can manage pricing plans"
  ON pricing_plans FOR ALL
  USING (auth.role() = 'service_role');

-- 5. DADOS INICIAIS - Preços por região
INSERT INTO pricing_plans (region, plan_name, price_cents, currency, stripe_price_id, features) VALUES
('brasil', 'Expresso', 4700, 'BRL', 'price_BR_EXPRESS', '["MP3 alta qualidade", "Capa personalizada", "Letra completa", "Download ilimitado", "Entrega em 24h"]'),
('usa', 'Express', 3900, 'USD', 'price_1SKUOFCkSeRm9TUrSTOgC0b3', '["High quality MP3", "Custom cover", "Full lyrics", "Unlimited download", "24h delivery"]'),
('internacional', 'Expreso', 4900, 'USD', 'price_1SKUOFCkSeRm9TUrSTOgC0b3', '["MP3 de alta calidad", "Portada personalizada", "Letra completa", "Descarga ilimitada", "Entrega en 24h"]')
ON CONFLICT (region, plan_name) DO UPDATE SET
  price_cents = EXCLUDED.price_cents,
  currency = EXCLUDED.currency,
  stripe_price_id = EXCLUDED.stripe_price_id,
  features = EXCLUDED.features,
  updated_at = NOW();

-- 6. TRIGGER para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_sessions_updated_at ON user_sessions;
CREATE TRIGGER update_user_sessions_updated_at
  BEFORE UPDATE ON user_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_pricing_plans_updated_at ON pricing_plans;
CREATE TRIGGER update_pricing_plans_updated_at
  BEFORE UPDATE ON pricing_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

