-- ==========================================
-- Criar Tabela de Mensagens de Email
-- Tracking de emails enviados no funil
-- ==========================================

CREATE TABLE IF NOT EXISTS email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id UUID NOT NULL, -- Referência será via view unificada
  message_type TEXT NOT NULL CHECK (message_type IN ('checkout_reminder', 'follow_up_1', 'follow_up_2', 'follow_up_3')),
  subject TEXT NOT NULL,
  html_content TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  resend_email_id TEXT,
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_email_messages_funnel_id ON email_messages(funnel_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_status ON email_messages(status);
CREATE INDEX IF NOT EXISTS idx_email_messages_message_type ON email_messages(message_type);
CREATE INDEX IF NOT EXISTS idx_email_messages_sent_at ON email_messages(sent_at);

-- RLS
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;

-- Política: Service role pode tudo
DROP POLICY IF EXISTS "Service role can manage email_messages" ON email_messages;
CREATE POLICY "Service role can manage email_messages" ON email_messages
  FOR ALL USING (auth.role() = 'service_role');

-- Política: Admins podem visualizar
DROP POLICY IF EXISTS "Admins can view email_messages" ON email_messages;
CREATE POLICY "Admins can view email_messages" ON email_messages
  FOR SELECT USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role::text = 'admin'
    )
  );

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_email_messages_updated_at ON email_messages;
CREATE TRIGGER update_email_messages_updated_at
  BEFORE UPDATE ON email_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE email_messages IS 'Tracking de emails enviados no funil de email';
COMMENT ON COLUMN email_messages.funnel_id IS 'ID do funil (referência via view unificada)';
COMMENT ON COLUMN email_messages.message_type IS 'Tipo de mensagem: checkout_reminder, follow_up_1, follow_up_2, follow_up_3';
COMMENT ON COLUMN email_messages.status IS 'Status: pending, sent, failed';
COMMENT ON COLUMN email_messages.resend_email_id IS 'ID do email no Resend após envio bem-sucedido';

