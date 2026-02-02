-- ==========================================
-- Correção completa do schema quizzes para projeto fhndlazabynapislzkmw
-- Garante session_id, customer_whatsapp e política UPDATE para upsert funcionar
-- ==========================================

-- 1. Adicionar colunas se não existirem
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS session_id UUID;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS customer_whatsapp TEXT;

-- 2. Constraint UNIQUE para session_id (necessária para upsert on_conflict)
-- Permite múltiplos NULLs, garante unicidade quando não-nulo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'quizzes_session_id_key' 
    AND conrelid = 'public.quizzes'::regclass
  ) THEN
    ALTER TABLE quizzes ADD CONSTRAINT quizzes_session_id_key UNIQUE (session_id);
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL; -- Constraint já existe
END $$;

-- 3. Índice para busca rápida (se não existir)
CREATE INDEX IF NOT EXISTS quizzes_session_id_idx ON quizzes(session_id);

-- 4. Política UPDATE (necessária para upsert - causa 401 sem ela)
DROP POLICY IF EXISTS "Anyone can update quizzes" ON quizzes;
CREATE POLICY "Anyone can update quizzes" 
ON quizzes 
FOR UPDATE 
USING (true) 
WITH CHECK (true);

-- Comentários
COMMENT ON COLUMN quizzes.session_id IS 'UUID único da sessão do navegador. Usado para UPSERT idempotente.';
COMMENT ON COLUMN quizzes.customer_whatsapp IS 'Número de WhatsApp do cliente no formato internacional';
