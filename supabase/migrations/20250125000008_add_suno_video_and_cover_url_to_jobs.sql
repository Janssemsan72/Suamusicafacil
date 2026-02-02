-- ==========================================
-- Adicionar colunas suno_video_url e suno_cover_url à tabela jobs
-- ==========================================
-- PROBLEMA: O código está tentando atualizar colunas que não existem na tabela jobs
-- SOLUÇÃO: Adicionar as colunas suno_video_url e suno_cover_url à tabela jobs
-- ==========================================

-- Adicionar coluna suno_video_url (URL do vídeo gerado pelo Suno)
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS suno_video_url TEXT;

-- Adicionar coluna suno_cover_url (URL da capa/thumbnail gerada pelo Suno)
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS suno_cover_url TEXT;

-- Comentários para documentação
COMMENT ON COLUMN jobs.suno_video_url IS 'URL do vídeo gerado pelo Suno (se disponível)';
COMMENT ON COLUMN jobs.suno_cover_url IS 'URL da capa/thumbnail gerada pelo Suno (se disponível)';

