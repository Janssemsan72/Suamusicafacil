-- ==========================================
-- DROPAR TABELAS EXISTENTES DE EMAIL
-- ==========================================

-- Dropar tabelas se existirem
DROP TABLE IF EXISTS email_templates_pt CASCADE;
DROP TABLE IF EXISTS email_templates_en CASCADE;
DROP TABLE IF EXISTS email_templates_es CASCADE;
DROP TABLE IF EXISTS email_templates CASCADE;
DROP TABLE IF EXISTS email_templates_i18n CASCADE;

-- Verificar se foram dropadas
SELECT 'TABELAS DROPADAS COM SUCESSO' as status;
