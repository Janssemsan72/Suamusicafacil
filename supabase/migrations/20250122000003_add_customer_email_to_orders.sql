-- ==========================================
-- Adicionar customer_email à tabela orders
-- ==========================================

-- Adicionar coluna customer_email
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email TEXT;

-- Adicionar coluna plan
ALTER TABLE orders ADD COLUMN IF NOT EXISTS plan TEXT;

-- Adicionar coluna stripe_checkout_session_id
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT;

-- Adicionar coluna provider
ALTER TABLE orders ADD COLUMN IF NOT EXISTS provider TEXT;

-- Adicionar coluna quizzes (relacionamento)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS quiz_id UUID;

-- Criar tabela quizzes se não existir
CREATE TABLE IF NOT EXISTS quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  about_who TEXT,
  style TEXT,
  language TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adicionar foreign key para quiz_id (se não existir)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_orders_quiz_id'
    ) THEN
        ALTER TABLE orders ADD CONSTRAINT fk_orders_quiz_id 
          FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Adicionar RLS para quizzes
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;

-- Política para quizzes
DROP POLICY IF EXISTS "Users can view their own quizzes" ON quizzes;
CREATE POLICY "Users can view their own quizzes"
  ON quizzes FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own quizzes" ON quizzes;
CREATE POLICY "Users can insert their own quizzes"
  ON quizzes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own quizzes" ON quizzes;
CREATE POLICY "Users can update their own quizzes"
  ON quizzes FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage quizzes" ON quizzes;
CREATE POLICY "Service role can manage quizzes"
  ON quizzes FOR ALL
  USING (auth.role() = 'service_role');

