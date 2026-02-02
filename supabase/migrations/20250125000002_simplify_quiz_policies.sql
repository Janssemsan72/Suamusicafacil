-- ==========================================
-- SIMPLIFICAR POLÍTICAS DO QUIZ - APENAS O ESSENCIAL
-- ==========================================

-- Remover TODAS as políticas existentes da tabela quizzes
DO $$
DECLARE
    policy_name TEXT;
BEGIN
    -- Listar e remover todas as políticas existentes
    FOR policy_name IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'quizzes'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON quizzes', policy_name);
    END LOOP;
END $$;

-- Criar apenas UMA política essencial para INSERT (qualquer um pode criar)
CREATE POLICY "Anyone can create quizzes" 
ON quizzes 
FOR INSERT 
WITH CHECK (true);

-- Criar apenas UMA política essencial para SELECT (qualquer um pode ler)
CREATE POLICY "Anyone can read quizzes" 
ON quizzes 
FOR SELECT 
USING (true);

-- Remover RLS se não for necessário (comentado por segurança)
-- ALTER TABLE quizzes DISABLE ROW LEVEL SECURITY;
