-- ==========================================
-- Adicionar campos para stems (vocals e instrumental)
-- ==========================================
-- Esta migration adiciona campos na tabela songs para armazenar
-- URLs dos stems separados (voz e instrumental) usando a API da Suno
-- ==========================================

-- Adicionar colunas para URLs dos stems
ALTER TABLE songs
ADD COLUMN IF NOT EXISTS vocals_url TEXT,
ADD COLUMN IF NOT EXISTS instrumental_url TEXT,
ADD COLUMN IF NOT EXISTS stems_separated_at TIMESTAMPTZ;

-- Adicionar índice para queries que filtram por stems separados
CREATE INDEX IF NOT EXISTS idx_songs_stems_separated_at 
ON songs(stems_separated_at) 
WHERE stems_separated_at IS NOT NULL;

-- Adicionar índice para queries que filtram por presença de stems
CREATE INDEX IF NOT EXISTS idx_songs_has_stems 
ON songs(vocals_url, instrumental_url) 
WHERE vocals_url IS NOT NULL AND instrumental_url IS NOT NULL;

-- Comentários
COMMENT ON COLUMN songs.vocals_url IS 'URL do arquivo de voz separado (stem vocals) gerado pela Suno API';
COMMENT ON COLUMN songs.instrumental_url IS 'URL do arquivo instrumental separado (stem instrumental) gerado pela Suno API';
COMMENT ON COLUMN songs.stems_separated_at IS 'Data e hora em que os stems foram separados pela primeira vez';

