-- ==========================================
-- CRIAR TABELA whatsapp_templates_i18n
-- Templates de mensagens WhatsApp multilíngues
-- ==========================================

CREATE TABLE IF NOT EXISTS whatsapp_templates_i18n (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_type TEXT NOT NULL,
  language TEXT NOT NULL, -- 'pt', 'en', 'es'
  message_text TEXT NOT NULL,
  button_configs JSONB DEFAULT '{"buttons": []}'::jsonb,
  variables JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_whatsapp_template_lang UNIQUE(template_type, language),
  CONSTRAINT valid_whatsapp_language CHECK (language IN ('pt', 'en', 'es')),
  CONSTRAINT valid_whatsapp_template_type CHECK (template_type IN ('payment_confirmed', 'music_ready'))
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_i18n_template_type ON whatsapp_templates_i18n(template_type);
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_i18n_language ON whatsapp_templates_i18n(language);
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_i18n_template_lang ON whatsapp_templates_i18n(template_type, language);

-- RLS (Row Level Security)
ALTER TABLE whatsapp_templates_i18n ENABLE ROW LEVEL SECURITY;

-- Política para permitir leitura pública (Edge Functions precisam ler)
CREATE POLICY "Allow public read access" ON whatsapp_templates_i18n
  FOR SELECT USING (true);

-- Política para permitir inserção/atualização apenas para service role e admins
CREATE POLICY "Allow service role full access" ON whatsapp_templates_i18n
  FOR ALL USING (auth.role() = 'service_role');

-- Política para admins poderem editar
CREATE POLICY "Allow admins to manage templates" ON whatsapp_templates_i18n
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_whatsapp_templates_i18n_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS trigger_update_whatsapp_templates_i18n_updated_at ON whatsapp_templates_i18n;
CREATE TRIGGER trigger_update_whatsapp_templates_i18n_updated_at
  BEFORE UPDATE ON whatsapp_templates_i18n
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_templates_i18n_updated_at();

-- Comentários
COMMENT ON TABLE whatsapp_templates_i18n IS 'Templates de mensagens WhatsApp multilíngues para o sistema Music Lovely';
COMMENT ON COLUMN whatsapp_templates_i18n.template_type IS 'Tipo do template (payment_confirmed, music_ready)';
COMMENT ON COLUMN whatsapp_templates_i18n.language IS 'Idioma do template (pt, en, es)';
COMMENT ON COLUMN whatsapp_templates_i18n.message_text IS 'Texto da mensagem com variáveis {{variable_name}}';
COMMENT ON COLUMN whatsapp_templates_i18n.button_configs IS 'Configuração dos botões em JSON: {"buttons": [{"id": "...", "text": "...", "type": "url", "url_template": "{{url}}"}]}';
COMMENT ON COLUMN whatsapp_templates_i18n.variables IS 'Variáveis disponíveis no template em formato JSON';

