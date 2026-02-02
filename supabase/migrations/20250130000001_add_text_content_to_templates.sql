-- ==========================================
-- Adicionar campo text_content aos templates
-- ==========================================
-- Adiciona suporte para versão texto dos emails (multipart/alternative)
-- Melhora deliverability e compatibilidade com clientes de email
-- ==========================================

-- Adicionar campo text_content à tabela email_templates_i18n
ALTER TABLE email_templates_i18n 
ADD COLUMN IF NOT EXISTS text_content TEXT;

-- Adicionar campo text_content à tabela email_templates (se existir)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'email_templates' 
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE email_templates 
    ADD COLUMN IF NOT EXISTS text_content TEXT;
  END IF;
END $$;

-- Comentário
COMMENT ON COLUMN email_templates_i18n.text_content IS 'Versão texto do email (para multipart/alternative). Gerado automaticamente do HTML se não fornecido.';

