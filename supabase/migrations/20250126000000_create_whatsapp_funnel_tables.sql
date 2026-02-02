-- ==========================================
-- Sistema de Funil WhatsApp com n8n
-- Tabelas para gerenciar funil de vendas e mensagens
-- ==========================================

-- 1. TABELA: whatsapp_funnel
-- Gerenciar estado do funil por pedido
CREATE TABLE IF NOT EXISTS whatsapp_funnel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  customer_whatsapp TEXT NOT NULL CHECK (customer_whatsapp IS NOT NULL AND LENGTH(TRIM(customer_whatsapp)) > 0),
  customer_email TEXT NOT NULL,
  funnel_status TEXT NOT NULL DEFAULT 'pending' CHECK (funnel_status IN ('pending', 'active', 'completed', 'exited', 'cancelled')),
  current_step INTEGER NOT NULL DEFAULT 0,
  last_message_sent_at TIMESTAMPTZ,
  next_message_at TIMESTAMPTZ,
  ab_variant TEXT, -- 'a' ou 'b' para teste A/B
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(order_id)
);

-- 2. TABELA: whatsapp_messages
-- Registrar todas as mensagens enviadas
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id UUID REFERENCES whatsapp_funnel(id) ON DELETE CASCADE NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('checkout_link', 'follow_up_1', 'follow_up_2', 'follow_up_3', 'follow_up_4', 'payment_thankyou', 'music_ready', 'final_cancelled')),
  message_text TEXT,
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  response_data JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABELA: checkout_links
-- Links seguros para checkout com quiz salvo
CREATE TABLE IF NOT EXISTS checkout_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(order_id, quiz_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_funnel_order_id ON whatsapp_funnel(order_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_funnel_status ON whatsapp_funnel(funnel_status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_funnel_next_message ON whatsapp_funnel(next_message_at) WHERE next_message_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_funnel_id ON whatsapp_messages(funnel_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_status ON whatsapp_messages(status);
CREATE INDEX IF NOT EXISTS idx_checkout_links_token ON checkout_links(token);
CREATE INDEX IF NOT EXISTS idx_checkout_links_order_id ON checkout_links(order_id);
CREATE INDEX IF NOT EXISTS idx_checkout_links_expires_at ON checkout_links(expires_at);

-- RLS (Row Level Security)
ALTER TABLE whatsapp_funnel ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkout_links ENABLE ROW LEVEL SECURITY;

-- Políticas RLS: Service role pode tudo
CREATE POLICY "Service role can manage whatsapp_funnel" ON whatsapp_funnel
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage whatsapp_messages" ON whatsapp_messages
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage checkout_links" ON checkout_links
  FOR ALL USING (auth.role() = 'service_role');

-- Políticas RLS: Admins podem visualizar tudo
CREATE POLICY "Admins can view whatsapp_funnel" ON whatsapp_funnel
  FOR SELECT USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role::text = 'admin'
    )
  );

CREATE POLICY "Admins can view whatsapp_messages" ON whatsapp_messages
  FOR SELECT USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role::text = 'admin'
    )
  );

CREATE POLICY "Admins can view checkout_links" ON checkout_links
  FOR SELECT USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role::text = 'admin'
    )
  );

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
DROP TRIGGER IF EXISTS update_whatsapp_funnel_updated_at ON whatsapp_funnel;
CREATE TRIGGER update_whatsapp_funnel_updated_at
  BEFORE UPDATE ON whatsapp_funnel
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_whatsapp_messages_updated_at ON whatsapp_messages;
CREATE TRIGGER update_whatsapp_messages_updated_at
  BEFORE UPDATE ON whatsapp_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comentários para documentação
COMMENT ON TABLE whatsapp_funnel IS 'Gerencia o estado do funil de vendas WhatsApp por pedido';
COMMENT ON TABLE whatsapp_messages IS 'Registra todas as mensagens WhatsApp enviadas no funil';
COMMENT ON TABLE checkout_links IS 'Links seguros para checkout com quiz salvo, válidos por 48h';

