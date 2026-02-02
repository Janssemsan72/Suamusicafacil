-- ==========================================
-- Tabela para rastrear separações de stems (voz e instrumental)
-- ==========================================
-- Esta tabela armazena informações sobre cada separação de stems,
-- incluindo taskId da separação, URLs salvos no nosso storage,
-- e metadados completos - seguindo as Regras de Ouro #2, #5, #6 e #7
-- ==========================================

-- Criar ENUM para status de separação
DO $$ BEGIN
  CREATE TYPE stem_separation_status AS ENUM ('pending', 'processing', 'completed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Criar tabela stem_separations
CREATE TABLE IF NOT EXISTS stem_separations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  separation_task_id TEXT UNIQUE,
  generation_task_id TEXT,
  audio_id TEXT NOT NULL,
  song_id UUID REFERENCES songs(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'separate_vocal',
  instrumental_url TEXT,
  vocal_url TEXT,
  origin_url TEXT,
  instrumental_size_bytes INTEGER,
  vocal_size_bytes INTEGER,
  instrumental_mime_type TEXT,
  vocal_mime_type TEXT,
  status stem_separation_status NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_stem_separations_task_id 
  ON stem_separations(separation_task_id)
  WHERE separation_task_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stem_separations_generation_task_id 
  ON stem_separations(generation_task_id)
  WHERE generation_task_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stem_separations_audio_id 
  ON stem_separations(audio_id);

CREATE INDEX IF NOT EXISTS idx_stem_separations_song_id 
  ON stem_separations(song_id);

CREATE INDEX IF NOT EXISTS idx_stem_separations_status 
  ON stem_separations(status);

-- Índice composto para buscar separações completas de uma song
CREATE INDEX IF NOT EXISTS idx_stem_separations_song_status 
  ON stem_separations(song_id, status)
  WHERE status = 'completed';

-- Criar trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_stem_separations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_stem_separations_updated_at
  BEFORE UPDATE ON stem_separations
  FOR EACH ROW
  EXECUTE FUNCTION update_stem_separations_updated_at();

-- Comentários
COMMENT ON TABLE stem_separations IS 'Rastreamento completo de separações de stems (voz e instrumental) - Regras de Ouro #2, #5, #6 e #7';
COMMENT ON COLUMN stem_separations.separation_task_id IS 'taskId da separação retornado pela Suno API';
COMMENT ON COLUMN stem_separations.generation_task_id IS 'taskId da geração original (referência para audio_generations)';
COMMENT ON COLUMN stem_separations.audio_id IS 'audioId usado na separação';
COMMENT ON COLUMN stem_separations.type IS 'Tipo de separação (sempre separate_vocal conforme Regra #2)';
COMMENT ON COLUMN stem_separations.instrumental_url IS 'URL do playback salvo no nosso storage (não CDN da Suno)';
COMMENT ON COLUMN stem_separations.vocal_url IS 'URL da voz salva no nosso storage (não CDN da Suno)';
COMMENT ON COLUMN stem_separations.instrumental_size_bytes IS 'Tamanho do arquivo instrumental em bytes';
COMMENT ON COLUMN stem_separations.vocal_size_bytes IS 'Tamanho do arquivo de voz em bytes';
COMMENT ON COLUMN stem_separations.status IS 'Status da separação: pending, processing, completed, failed';
COMMENT ON COLUMN stem_separations.error_message IS 'Mensagem de erro caso a separação falhe';

