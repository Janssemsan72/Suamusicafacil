-- ==========================================
-- Tabela: whatsapp_interactions
-- Registrar interações do cliente (cliques em botões, mensagens recebidas, etc.)
-- ==========================================

CREATE TABLE IF NOT EXISTS whatsapp_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id UUID REFERENCES whatsapp_funnel(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('button_click', 'message_received', 'message_status', 'other')),
  button_id TEXT,
  button_text TEXT,
  message_text TEXT,
  message_id TEXT, -- ID da mensagem do Evolution API
  delivery_status TEXT CHECK (delivery_status IN ('sent', 'delivered', 'read', 'failed', 'unknown')),
  whatsapp_number TEXT NOT NULL,
  event_data JSONB, -- Dados completos do evento do Evolution API
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_whatsapp_interactions_funnel_id ON whatsapp_interactions(funnel_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_interactions_order_id ON whatsapp_interactions(order_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_interactions_whatsapp_number ON whatsapp_interactions(whatsapp_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_interactions_type ON whatsapp_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_whatsapp_interactions_created_at ON whatsapp_interactions(created_at);

-- RLS
ALTER TABLE whatsapp_interactions ENABLE ROW LEVEL SECURITY;

-- Dropar policies se existirem (para tornar idempotente)
DROP POLICY IF EXISTS "Service role can manage whatsapp_interactions" ON whatsapp_interactions;
DROP POLICY IF EXISTS "Admins can view whatsapp_interactions" ON whatsapp_interactions;

-- Service role pode fazer tudo
CREATE POLICY "Service role can manage whatsapp_interactions" ON whatsapp_interactions
  FOR ALL USING (auth.role() = 'service_role');

-- Admins podem visualizar
CREATE POLICY "Admins can view whatsapp_interactions" ON whatsapp_interactions
  FOR SELECT USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role::text = 'admin'
    )
  );

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_whatsapp_interactions_updated_at ON whatsapp_interactions;
CREATE TRIGGER update_whatsapp_interactions_updated_at
  BEFORE UPDATE ON whatsapp_interactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE whatsapp_interactions IS 'Registra interações do cliente no WhatsApp (cliques, mensagens, status)';
COMMENT ON COLUMN whatsapp_interactions.interaction_type IS 'Tipo de interação: button_click, message_received, message_status, other';
COMMENT ON COLUMN whatsapp_interactions.event_data IS 'Dados completos do evento recebido do Evolution API';

