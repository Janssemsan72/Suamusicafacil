-- ==========================================
-- CRIAR TABELA email_templates_i18n
-- ==========================================

CREATE TABLE IF NOT EXISTS email_templates_i18n (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_type TEXT NOT NULL,
  language TEXT NOT NULL, -- 'pt', 'en', 'es'
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  from_name TEXT DEFAULT 'Music Lovely',
  from_email TEXT DEFAULT 'no-reply@musiclovely.com',
  reply_to TEXT DEFAULT 'no-reply@musiclovely.com',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_template_lang UNIQUE(template_type, language),
  CONSTRAINT valid_language CHECK (language IN ('pt', 'en', 'es'))
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_email_templates_i18n_template_type ON email_templates_i18n(template_type);
CREATE INDEX IF NOT EXISTS idx_email_templates_i18n_language ON email_templates_i18n(language);
CREATE INDEX IF NOT EXISTS idx_email_templates_i18n_template_lang ON email_templates_i18n(template_type, language);

-- RLS (Row Level Security)
ALTER TABLE email_templates_i18n ENABLE ROW LEVEL SECURITY;

-- Política para permitir leitura pública
CREATE POLICY "Allow public read access" ON email_templates_i18n
  FOR SELECT USING (true);

-- Política para permitir inserção/atualização apenas para service role
CREATE POLICY "Allow service role full access" ON email_templates_i18n
  FOR ALL USING (auth.role() = 'service_role');

-- Comentários
COMMENT ON TABLE email_templates_i18n IS 'Templates de email multilíngues para o sistema Music Lovely';
COMMENT ON COLUMN email_templates_i18n.template_type IS 'Tipo do template (order_paid, music_released, etc.)';
COMMENT ON COLUMN email_templates_i18n.language IS 'Idioma do template (pt, en, es)';
COMMENT ON COLUMN email_templates_i18n.subject IS 'Assunto do email';
COMMENT ON COLUMN email_templates_i18n.html_content IS 'Conteúdo HTML do email';
COMMENT ON COLUMN email_templates_i18n.variables IS 'Variáveis disponíveis no template';
