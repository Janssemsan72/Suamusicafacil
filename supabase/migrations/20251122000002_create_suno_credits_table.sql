-- ==========================================
-- Tabela para gerenciar créditos da Suno localmente
-- ==========================================
-- Esta tabela armazena os créditos da Suno e é atualizada
-- automaticamente a cada envio para a API
-- ==========================================

CREATE TABLE IF NOT EXISTS suno_credits (
  id UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  credits INTEGER NOT NULL DEFAULT 0,
  credits_used INTEGER NOT NULL DEFAULT 0,
  total_credits INTEGER NOT NULL DEFAULT 0,
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir registro inicial com 3466 créditos
INSERT INTO suno_credits (id, credits, credits_used, total_credits, last_updated_at)
VALUES ('00000000-0000-0000-0000-000000000000'::uuid, 3466, 0, 3466, NOW())
ON CONFLICT (id) DO UPDATE
SET 
  credits = 3466,
  total_credits = 3466,
  last_updated_at = NOW(),
  updated_at = NOW();

-- Índice para performance
CREATE INDEX IF NOT EXISTS idx_suno_credits_id ON suno_credits(id);

-- Comentários
COMMENT ON TABLE suno_credits IS 
'Tabela para armazenar créditos da Suno. Sempre deve ter apenas um registro. Créditos são decrementados automaticamente a cada envio para a API.';

COMMENT ON COLUMN suno_credits.credits IS 'Créditos restantes disponíveis';
COMMENT ON COLUMN suno_credits.credits_used IS 'Total de créditos já utilizados';
COMMENT ON COLUMN suno_credits.total_credits IS 'Total de créditos inicial';

