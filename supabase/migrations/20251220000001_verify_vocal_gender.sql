-- Query de verificação: Verificar se a coluna vocal_gender existe e está configurada corretamente

SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default,
    (SELECT obj_description(c.oid, 'pg_class') 
     FROM pg_class c 
     WHERE c.relname = 'quizzes') as table_comment
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name = 'quizzes' 
    AND column_name = 'vocal_gender';

-- Verificar constraint CHECK
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.quizzes'::regclass
    AND conname LIKE '%vocal_gender%';

