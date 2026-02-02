-- Migration: Adicionar coluna session_id à tabela quizzes
-- Objetivo: Permitir identificação única de quizzes por sessão do navegador
-- Isso garante que quizzes possam ser recuperados mesmo sem email/telefone

-- Adicionar coluna session_id (UUID, nullable para compatibilidade com dados existentes)
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS session_id UUID;

-- Criar índice único para garantir idempotência e busca rápida
-- O índice parcial (WHERE session_id IS NOT NULL) permite múltiplos quizzes sem session_id
CREATE UNIQUE INDEX IF NOT EXISTS quizzes_session_id_idx 
ON quizzes(session_id) 
WHERE session_id IS NOT NULL;

-- Comentário na coluna para documentação
COMMENT ON COLUMN quizzes.session_id IS 'UUID único que identifica a sessão do navegador. Usado para vincular quiz ao cliente antes de ter email/telefone. Permite UPSERT idempotente.';

