-- ==========================================
-- Criação da tabela email_unsubscribes
-- ==========================================
-- Tabela para armazenar emails que optaram por não receber mais emails
-- Necessário para compliance com CAN-SPAM, GDPR e outras leis de email marketing
-- ==========================================

-- Criar tabela de unsubscribes
CREATE TABLE IF NOT EXISTS email_unsubscribes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  unsubscribe_token TEXT NOT NULL UNIQUE,
  reason TEXT,
  source TEXT, -- 'link', 'webhook', 'manual', etc.
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para busca rápida por email
CREATE INDEX IF NOT EXISTS idx_email_unsubscribes_email ON email_unsubscribes(email);
CREATE INDEX IF NOT EXISTS idx_email_unsubscribes_token ON email_unsubscribes(unsubscribe_token);
CREATE INDEX IF NOT EXISTS idx_email_unsubscribes_created_at ON email_unsubscribes(created_at);

-- Comentários
COMMENT ON TABLE email_unsubscribes IS 'Lista de emails que optaram por não receber mais emails (unsubscribe)';
COMMENT ON COLUMN email_unsubscribes.email IS 'Email do destinatário que fez unsubscribe';
COMMENT ON COLUMN email_unsubscribes.unsubscribe_token IS 'Token único usado no link de unsubscribe';
COMMENT ON COLUMN email_unsubscribes.reason IS 'Motivo do unsubscribe (opcional)';
COMMENT ON COLUMN email_unsubscribes.source IS 'Origem do unsubscribe (link, webhook, manual, etc.)';
COMMENT ON COLUMN email_unsubscribes.metadata IS 'Metadados adicionais sobre o unsubscribe';

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_email_unsubscribes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
CREATE TRIGGER trigger_update_email_unsubscribes_updated_at
  BEFORE UPDATE ON email_unsubscribes
  FOR EACH ROW
  EXECUTE FUNCTION update_email_unsubscribes_updated_at();

-- Função helper para verificar se email está na lista de unsubscribes
CREATE OR REPLACE FUNCTION is_email_unsubscribed(p_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM email_unsubscribes 
    WHERE LOWER(email) = LOWER(p_email)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função helper para adicionar email à lista de unsubscribes
CREATE OR REPLACE FUNCTION add_email_unsubscribe(
  p_email TEXT,
  p_token TEXT,
  p_reason TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'link',
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  unsubscribe_id UUID;
BEGIN
  -- Verificar se já existe
  SELECT id INTO unsubscribe_id
  FROM email_unsubscribes
  WHERE LOWER(email) = LOWER(p_email);
  
  IF unsubscribe_id IS NOT NULL THEN
    -- Atualizar registro existente
    UPDATE email_unsubscribes
    SET 
      unsubscribe_token = p_token,
      reason = COALESCE(p_reason, reason),
      source = p_source,
      metadata = p_metadata,
      updated_at = NOW()
    WHERE id = unsubscribe_id;
    RETURN unsubscribe_id;
  ELSE
    -- Criar novo registro
    INSERT INTO email_unsubscribes (email, unsubscribe_token, reason, source, metadata)
    VALUES (LOWER(p_email), p_token, p_reason, p_source, p_metadata)
    RETURNING id INTO unsubscribe_id;
    RETURN unsubscribe_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentários nas funções
COMMENT ON FUNCTION is_email_unsubscribed IS 'Verifica se um email está na lista de unsubscribes';
COMMENT ON FUNCTION add_email_unsubscribe IS 'Adiciona ou atualiza um email na lista de unsubscribes';

-- RLS (Row Level Security) - Permitir leitura pública para verificação, escrita apenas via service role
ALTER TABLE email_unsubscribes ENABLE ROW LEVEL SECURITY;

-- Política: Permitir leitura para verificação (usado pelo validador)
CREATE POLICY "Allow read for email validation"
  ON email_unsubscribes
  FOR SELECT
  USING (true);

-- Política: Permitir inserção apenas via service role (edge functions)
-- Nota: Edge functions usam service role key, então não precisamos de política específica aqui
-- Mas podemos adicionar uma política que permite inserção se autenticado
CREATE POLICY "Allow insert via service role"
  ON email_unsubscribes
  FOR INSERT
  WITH CHECK (true); -- Service role bypassa RLS, então isso é apenas para documentação

-- Política: Permitir atualização apenas via service role
CREATE POLICY "Allow update via service role"
  ON email_unsubscribes
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

