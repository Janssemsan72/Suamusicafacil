-- ==========================================
-- CORRIGIR CONSTRAINT customer_email NA TABELA QUIZZES
-- ==========================================

-- Primeiro, atualizar quizzes existentes sem email com um valor padrão
UPDATE quizzes 
SET customer_email = 'noreply@musiclovely.com'
WHERE customer_email IS NULL;

-- Adicionar constraint NOT NULL para customer_email em quizzes (se não existir)
DO $$
BEGIN
    -- Verificar se a constraint já existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'quizzes_customer_email_not_null' 
        AND table_name = 'quizzes'
    ) THEN
        -- Adicionar constraint NOT NULL
        ALTER TABLE quizzes 
        ALTER COLUMN customer_email SET NOT NULL;
        
        -- Adicionar comentário
        COMMENT ON COLUMN quizzes.customer_email IS 'Email do cliente - obrigatório';
    END IF;
END $$;
