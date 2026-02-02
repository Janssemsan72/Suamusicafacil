-- ==========================================
-- Tabela para rastrear gerações de áudio da Suno
-- ==========================================
-- Esta tabela armazena informações sobre cada geração de áudio,
-- incluindo taskId, audioId e URLs, seguindo a Regra de Ouro #1
-- ==========================================

-- Criar ENUM para status de geração
DO $$ BEGIN
  CREATE TYPE audio_generation_status AS ENUM ('pending', 'processing', 'completed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Criar tabela audio_generations
CREATE TABLE IF NOT EXISTS audio_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_task_id TEXT NOT NULL UNIQUE,
  audio_id TEXT NOT NULL,
  audio_url TEXT,
  song_id UUID REFERENCES songs(id) ON DELETE SET NULL,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  status audio_generation_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_audio_generations_task_id 
  ON audio_generations(generation_task_id);

CREATE INDEX IF NOT EXISTS idx_audio_generations_audio_id 
  ON audio_generations(audio_id);

CREATE INDEX IF NOT EXISTS idx_audio_generations_song_id 
  ON audio_generations(song_id);

CREATE INDEX IF NOT EXISTS idx_audio_generations_job_id 
  ON audio_generations(job_id);

CREATE INDEX IF NOT EXISTS idx_audio_generations_order_id 
  ON audio_generations(order_id);

CREATE INDEX IF NOT EXISTS idx_audio_generations_status 
  ON audio_generations(status);

-- Criar trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_audio_generations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_audio_generations_updated_at
  BEFORE UPDATE ON audio_generations
  FOR EACH ROW
  EXECUTE FUNCTION update_audio_generations_updated_at();

-- Comentários
COMMENT ON TABLE audio_generations IS 'Rastreamento completo de gerações de áudio da Suno API - Regra de Ouro #1 e #7';
COMMENT ON COLUMN audio_generations.generation_task_id IS 'taskId da geração original retornado pela Suno API';
COMMENT ON COLUMN audio_generations.audio_id IS 'audioId/clipId de cada faixa gerada';
COMMENT ON COLUMN audio_generations.audio_url IS 'URL original do áudio retornado pela Suno';
COMMENT ON COLUMN audio_generations.status IS 'Status da geração: pending, processing, completed, failed';

