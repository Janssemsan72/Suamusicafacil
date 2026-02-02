-- ==========================================
-- Criar tabela para armazenar métricas de comportamento (Clarity/Hotjar)
-- ==========================================

-- Tabela principal de analytics de comportamento
CREATE TABLE IF NOT EXISTS behavior_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  page_path TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraint para evitar duplicatas
  UNIQUE(date, page_path, event_type)
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_behavior_analytics_date ON behavior_analytics(date DESC);
CREATE INDEX IF NOT EXISTS idx_behavior_analytics_page_path ON behavior_analytics(page_path);
CREATE INDEX IF NOT EXISTS idx_behavior_analytics_event_type ON behavior_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_behavior_analytics_date_page ON behavior_analytics(date DESC, page_path);
CREATE INDEX IF NOT EXISTS idx_behavior_analytics_metadata ON behavior_analytics USING GIN(metadata);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_behavior_analytics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS trigger_update_behavior_analytics_updated_at ON behavior_analytics;
CREATE TRIGGER trigger_update_behavior_analytics_updated_at
  BEFORE UPDATE ON behavior_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_behavior_analytics_updated_at();

-- Habilitar RLS
ALTER TABLE behavior_analytics ENABLE ROW LEVEL SECURITY;

-- Política: Apenas admins podem ler
DROP POLICY IF EXISTS "Admins can read behavior_analytics" ON behavior_analytics;
CREATE POLICY "Admins can read behavior_analytics"
  ON behavior_analytics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Política: Permitir inserção pública (para eventos de visitantes)
-- A Edge Function valida e usa service_role quando necessário
DROP POLICY IF EXISTS "Admins can insert behavior_analytics" ON behavior_analytics;
DROP POLICY IF EXISTS "Public can insert behavior_analytics" ON behavior_analytics;
CREATE POLICY "Public can insert behavior_analytics"
  ON behavior_analytics FOR INSERT
  WITH CHECK (true);

-- Política: Apenas admins podem atualizar
DROP POLICY IF EXISTS "Admins can update behavior_analytics" ON behavior_analytics;
CREATE POLICY "Admins can update behavior_analytics"
  ON behavior_analytics FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Comentários para documentação
COMMENT ON TABLE behavior_analytics IS 'Armazena métricas agregadas de comportamento do usuário (Clarity/Hotjar)';
COMMENT ON COLUMN behavior_analytics.date IS 'Data da métrica';
COMMENT ON COLUMN behavior_analytics.page_path IS 'Caminho da página (ex: /, /quiz, /checkout)';
COMMENT ON COLUMN behavior_analytics.event_type IS 'Tipo de evento (page_view, dead_click, rage_click, scroll_depth, js_error, etc)';
COMMENT ON COLUMN behavior_analytics.event_count IS 'Quantidade de eventos deste tipo';
COMMENT ON COLUMN behavior_analytics.metadata IS 'Metadados adicionais em JSON (device, browser, language, etc)';

