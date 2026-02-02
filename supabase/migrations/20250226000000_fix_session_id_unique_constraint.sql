-- Migration: Ajustar session_id para UNIQUE constraint
-- Objetivo: Trocar índice parcial por UNIQUE constraint (mais robusto)
-- Permite múltiplos NULLs, mas garante unicidade quando não-nulo

-- Remover índice parcial existente
DROP INDEX IF EXISTS quizzes_session_id_idx;

-- Adicionar UNIQUE constraint (permite múltiplos NULLs)
-- PostgreSQL permite múltiplos NULLs em colunas UNIQUE
ALTER TABLE quizzes 
ADD CONSTRAINT quizzes_session_id_key UNIQUE (session_id);

-- Recriar índice para busca rápida (não é obrigatório, mas ajuda)
CREATE INDEX IF NOT EXISTS quizzes_session_id_idx ON quizzes(session_id);

-- Comentário na constraint para documentação
COMMENT ON CONSTRAINT quizzes_session_id_key ON quizzes IS 'Garante que session_id seja único quando não-nulo. Permite múltiplos NULLs para quizzes antigos. Usado para UPSERT idempotente.';

