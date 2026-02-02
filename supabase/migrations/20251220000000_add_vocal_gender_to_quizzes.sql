-- Adicionar coluna vocal_gender à tabela quizzes se não existir
-- Esta migração garante que a coluna existe e está no schema cache do Supabase

DO $$ 
BEGIN
  -- Verificar se a coluna já existe
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'quizzes' 
    AND column_name = 'vocal_gender'
  ) THEN
    -- Adicionar coluna vocal_gender
    ALTER TABLE quizzes 
    ADD COLUMN vocal_gender VARCHAR(1) CHECK (vocal_gender IN ('m', 'f', '') OR vocal_gender IS NULL);
    
    -- Adicionar comentário explicativo
    COMMENT ON COLUMN quizzes.vocal_gender IS 'Preferência de gênero vocal: m=masculino, f=feminino, empty/null=sem preferência';
  END IF;
END $$;

-- Garantir que o índice único não conflita (se necessário)
-- O índice já deve existir se a coluna já existia, mas vamos garantir

