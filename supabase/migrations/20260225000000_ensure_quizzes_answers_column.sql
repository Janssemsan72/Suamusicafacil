-- Garantir coluna answers (JSONB) na tabela quizzes para letra aprovada/gerada no admin
-- Idempotente: seguro rodar mesmo se a coluna já existir (ex.: migração 20250122000004)
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS answers JSONB;
