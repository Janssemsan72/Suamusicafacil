-- Migration: Adicionar índices de performance para lyrics_approvals
-- Objetivo: Otimizar queries da página /lyrics que filtram por status e ordenam por created_at

-- Índice composto para queries mais comuns: status + created_at DESC
-- Usado em: SELECT * FROM lyrics_approvals WHERE status IN (...) ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_lyrics_approvals_status_created_at 
ON lyrics_approvals(status, created_at DESC);

-- Índice parcial para approved_at (apenas registros aprovados)
-- Usado em: SELECT * FROM lyrics_approvals WHERE status = 'approved' ORDER BY approved_at DESC
CREATE INDEX IF NOT EXISTS idx_lyrics_approvals_approved_at 
ON lyrics_approvals(approved_at DESC) 
WHERE approved_at IS NOT NULL;

-- Índice parcial para rejected_at (apenas registros rejeitados)
-- Usado em: SELECT * FROM lyrics_approvals WHERE status = 'rejected' ORDER BY rejected_at DESC
CREATE INDEX IF NOT EXISTS idx_lyrics_approvals_rejected_at 
ON lyrics_approvals(rejected_at DESC) 
WHERE rejected_at IS NOT NULL;

-- Comentários para documentação
COMMENT ON INDEX idx_lyrics_approvals_status_created_at IS 
'Índice composto para otimizar queries que filtram por status e ordenam por created_at (página /lyrics)';

COMMENT ON INDEX idx_lyrics_approvals_approved_at IS 
'Índice parcial para otimizar queries de aprovações aprovadas ordenadas por approved_at';

COMMENT ON INDEX idx_lyrics_approvals_rejected_at IS 
'Índice parcial para otimizar queries de aprovações rejeitadas ordenadas por rejected_at';



