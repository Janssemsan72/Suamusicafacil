-- ==========================================
-- Adicionar customer_email e outras colunas à tabela quizzes
-- ==========================================

-- Adicionar coluna customer_email
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS customer_email TEXT;

-- Adicionar coluna relationship
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS relationship TEXT;

-- Adicionar coluna qualities
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS qualities TEXT;

-- Adicionar coluna memories
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS memories TEXT;

-- Adicionar coluna message
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS message TEXT;

-- Adicionar coluna key_moments
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS key_moments TEXT;

-- Adicionar coluna occasion
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS occasion TEXT;

-- Adicionar coluna desired_tone
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS desired_tone TEXT;

-- Adicionar coluna answers
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS answers JSONB;

-- Adicionar coluna transaction_id
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS transaction_id TEXT;
-- Adicionar customer_email e outras colunas à tabela quizzes
-- ==========================================

-- Adicionar coluna customer_email
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS customer_email TEXT;

-- Adicionar coluna relationship
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS relationship TEXT;

-- Adicionar coluna qualities
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS qualities TEXT;

-- Adicionar coluna memories
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS memories TEXT;

-- Adicionar coluna message
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS message TEXT;

-- Adicionar coluna key_moments
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS key_moments TEXT;

-- Adicionar coluna occasion
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS occasion TEXT;

-- Adicionar coluna desired_tone
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS desired_tone TEXT;

-- Adicionar coluna answers
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS answers JSONB;

-- Adicionar coluna transaction_id
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS transaction_id TEXT;
