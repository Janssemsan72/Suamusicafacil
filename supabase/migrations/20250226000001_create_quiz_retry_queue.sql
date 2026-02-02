-- Migration: Criar tabela quiz_retry_queue para fila de retry no servidor
-- Objetivo: Mover lógica de retry do cliente para servidor (mais confiável)
-- Permite que quizzes sejam salvos mesmo se cliente fechar a aba

CREATE TABLE IF NOT EXISTS quiz_retry_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID,
  quiz_payload JSONB NOT NULL,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  next_retry_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

-- Índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_quiz_retry_queue_status ON quiz_retry_queue(status, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_quiz_retry_queue_session_id ON quiz_retry_queue(session_id);
CREATE INDEX IF NOT EXISTS idx_quiz_retry_queue_created_at ON quiz_retry_queue(created_at DESC);

-- Comentários para documentação
COMMENT ON TABLE quiz_retry_queue IS 'Fila de retry no servidor para quizzes que falharam ao ser salvos. Processada periodicamente por edge function.';
COMMENT ON COLUMN quiz_retry_queue.session_id IS 'UUID da sessão do quiz (opcional, para evitar duplicados)';
COMMENT ON COLUMN quiz_retry_queue.quiz_payload IS 'Payload completo do quiz em formato JSONB';
COMMENT ON COLUMN quiz_retry_queue.attempts IS 'Número de tentativas já realizadas';
COMMENT ON COLUMN quiz_retry_queue.max_attempts IS 'Número máximo de tentativas antes de marcar como failed';
COMMENT ON COLUMN quiz_retry_queue.next_retry_at IS 'Timestamp da próxima tentativa (exponential backoff)';
COMMENT ON COLUMN quiz_retry_queue.status IS 'Status do item: pending, processing, completed, failed';

