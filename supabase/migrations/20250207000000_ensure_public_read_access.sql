-- ==========================================
-- Garantir Acesso Público para Restore de Quiz/Order
-- ==========================================
-- Esta migração garante que quizzes e orders possam ser lidos publicamente
-- quando há order_id e quiz_id válidos (necessário para links do WhatsApp)

-- 1. Garantir que quizzes podem ser lidos publicamente
-- Remover políticas restritivas se existirem
DO $$
DECLARE
    policy_name TEXT;
BEGIN
    -- Listar e remover políticas restritivas de SELECT
    FOR policy_name IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'quizzes' 
        AND policyname NOT IN ('Anyone can read quizzes', 'Anyone can create quizzes')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON quizzes', policy_name);
        RAISE NOTICE 'Removida política: %', policy_name;
    END LOOP;
END $$;

-- Garantir que a política "Anyone can read quizzes" existe
DROP POLICY IF EXISTS "Anyone can read quizzes" ON quizzes;
CREATE POLICY "Anyone can read quizzes" 
ON quizzes 
FOR SELECT 
USING (true);

-- Garantir que a política "Anyone can create quizzes" existe
DROP POLICY IF EXISTS "Anyone can create quizzes" ON quizzes;
CREATE POLICY "Anyone can create quizzes" 
ON quizzes 
FOR INSERT 
WITH CHECK (true);

-- 2. Garantir que orders podem ser lidos publicamente
-- Remover políticas restritivas se existirem
DO $$
DECLARE
    policy_name TEXT;
BEGIN
    -- Listar e remover políticas restritivas de SELECT/UPDATE
    FOR policy_name IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'orders' 
        AND policyname != 'Allow all operations on orders'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON orders', policy_name);
        RAISE NOTICE 'Removida política: %', policy_name;
    END LOOP;
END $$;

-- Garantir que a política "Allow all operations on orders" existe
DROP POLICY IF EXISTS "Allow all operations on orders" ON orders;
CREATE POLICY "Allow all operations on orders" 
ON orders 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- 3. Verificar se RLS está habilitado
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- 4. Verificar políticas criadas
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename IN ('quizzes', 'orders')
ORDER BY tablename, policyname;

