-- ==========================================
-- Criar Função RPC para Buscar Quiz Publicamente
-- ==========================================
-- Esta função permite buscar quiz mesmo com RLS ativo
-- usando service role internamente

CREATE OR REPLACE FUNCTION public.get_quiz_by_id(quiz_id_param UUID)
RETURNS TABLE (
    id UUID,
    about_who TEXT,
    relationship TEXT,
    style TEXT,
    language TEXT,
    vocal_gender TEXT,
    qualities TEXT,
    memories TEXT,
    message TEXT,
    occasion TEXT,
    desired_tone TEXT,
    key_moments JSONB,
    answers JSONB,
    customer_email TEXT,
    customer_whatsapp TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER -- Executa com permissões do criador (service role)
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        q.id,
        q.about_who,
        q.relationship,
        q.style,
        q.language,
        q.vocal_gender,
        q.qualities,
        q.memories,
        q.message,
        q.occasion,
        q.desired_tone,
        q.key_moments,
        q.answers,
        q.customer_email,
        q.customer_whatsapp,
        q.created_at,
        q.updated_at
    FROM quizzes q
    WHERE q.id = quiz_id_param;
END;
$$;

-- Garantir que a função pode ser chamada publicamente
GRANT EXECUTE ON FUNCTION public.get_quiz_by_id(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_quiz_by_id(UUID) TO authenticated;

-- Comentário
COMMENT ON FUNCTION public.get_quiz_by_id(UUID) IS 'Busca quiz por ID, ignorando RLS. Usado para links do WhatsApp.';

-- ==========================================
-- Garantir Políticas RLS Permissivas
-- ==========================================

-- Remover TODAS as políticas existentes de quizzes
DO $$
DECLARE
    policy_name TEXT;
BEGIN
    FOR policy_name IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'quizzes'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON quizzes', policy_name);
        RAISE NOTICE 'Removida política: %', policy_name;
    END LOOP;
END $$;

-- Criar política permissiva de SELECT
CREATE POLICY "Anyone can read quizzes" 
ON quizzes 
FOR SELECT 
TO anon, authenticated
USING (true);

-- Criar política permissiva de INSERT
CREATE POLICY "Anyone can create quizzes" 
ON quizzes 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

-- Criar política permissiva de UPDATE
CREATE POLICY "Anyone can update quizzes" 
ON quizzes 
FOR UPDATE 
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Garantir que RLS está habilitado
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;

-- Verificar políticas criadas
SELECT 
    tablename,
    policyname,
    cmd,
    roles
FROM pg_policies 
WHERE tablename = 'quizzes'
ORDER BY policyname;

