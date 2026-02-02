-- ==========================================
-- LIMPEZA COMPLETA DE SCHEMAS DE EMAIL
-- Remove schemas duplicados e mantém apenas o principal
-- ==========================================

-- 1. DROPAR TODAS AS TABELAS DE EMAIL EXISTENTES
DROP TABLE IF EXISTS email_templates CASCADE;
DROP TABLE IF EXISTS email_templates_i18n CASCADE;
DROP TABLE IF EXISTS email_templates_pt CASCADE;
DROP TABLE IF EXISTS email_templates_en CASCADE;
DROP TABLE IF EXISTS email_templates_es CASCADE;

-- 2. DROPAR POLÍTICAS RLS SE EXISTIREM (com verificação de existência)
DO $$
BEGIN
    -- Tentar dropar políticas se as tabelas existirem
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_templates_i18n') THEN
        DROP POLICY IF EXISTS "Allow public read access" ON email_templates_i18n;
        DROP POLICY IF EXISTS "Allow service role full access" ON email_templates_i18n;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_templates_pt') THEN
        DROP POLICY IF EXISTS "Allow public read access pt" ON email_templates_pt;
        DROP POLICY IF EXISTS "Allow service role full access pt" ON email_templates_pt;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_templates_en') THEN
        DROP POLICY IF EXISTS "Allow public read access en" ON email_templates_en;
        DROP POLICY IF EXISTS "Allow service role full access en" ON email_templates_en;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_templates_es') THEN
        DROP POLICY IF EXISTS "Allow public read access es" ON email_templates_es;
        DROP POLICY IF EXISTS "Allow service role full access es" ON email_templates_es;
    END IF;
END $$;

-- 3. DROPAR ÍNDICES SE EXISTIREM
DROP INDEX IF EXISTS idx_email_templates_i18n_template_type;
DROP INDEX IF EXISTS idx_email_templates_i18n_language;
DROP INDEX IF EXISTS idx_email_templates_i18n_template_lang;

-- 4. RECRIAR AS 3 TABELAS PRINCIPAIS
-- Tabela Português
CREATE TABLE email_templates_pt (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_type TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  from_name TEXT DEFAULT 'Music Lovely',
  from_email TEXT DEFAULT 'no-reply@musiclovely.com',
  reply_to TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela Inglês
CREATE TABLE email_templates_en (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_type TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  from_name TEXT DEFAULT 'Music Lovely',
  from_email TEXT DEFAULT 'no-reply@musiclovely.com',
  reply_to TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela Espanhol
CREATE TABLE email_templates_es (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_type TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  from_name TEXT DEFAULT 'Music Lovely',
  from_email TEXT DEFAULT 'no-reply@musiclovely.com',
  reply_to TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. CONFIGURAR RLS
ALTER TABLE email_templates_pt ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates_en ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates_es ENABLE ROW LEVEL SECURITY;

-- Políticas para email_templates_pt
CREATE POLICY "Allow service role full access pt" ON email_templates_pt
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow public read access pt" ON email_templates_pt
  FOR SELECT USING (true);

-- Políticas para email_templates_en
CREATE POLICY "Allow service role full access en" ON email_templates_en
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow public read access en" ON email_templates_en
  FOR SELECT USING (true);

-- Políticas para email_templates_es
CREATE POLICY "Allow service role full access es" ON email_templates_es
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow public read access es" ON email_templates_es
  FOR SELECT USING (true);

-- 6. VERIFICAR RESULTADO
SELECT 
  'LIMPEZA E RECRIAÇÃO CONCLUÍDA' as status,
  '3 tabelas criadas: email_templates_pt, email_templates_en, email_templates_es' as message,
  NOW() as executed_at;
