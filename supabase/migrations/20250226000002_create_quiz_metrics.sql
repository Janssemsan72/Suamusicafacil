-- Migration: Criar tabela quiz_metrics para monitoramento
-- Objetivo: Coletar métricas sobre salvamento de quizzes e criação de pedidos
-- Permite monitorar saúde do sistema e identificar problemas

CREATE TABLE IF NOT EXISTS quiz_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_date DATE NOT NULL,
  quizzes_saved INTEGER DEFAULT 0,
  quizzes_saved_with_session_id INTEGER DEFAULT 0,
  orders_created INTEGER DEFAULT 0,
  orders_with_quiz INTEGER DEFAULT 0,
  orders_without_quiz INTEGER DEFAULT 0,
  quizzes_lost INTEGER DEFAULT 0,
  retry_queue_size INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(metric_date)
);

-- Índice para busca rápida por data
CREATE INDEX IF NOT EXISTS idx_quiz_metrics_date ON quiz_metrics(metric_date DESC);

-- Comentários para documentação
COMMENT ON TABLE quiz_metrics IS 'Métricas diárias sobre salvamento de quizzes e criação de pedidos. Atualizada automaticamente via triggers.';
COMMENT ON COLUMN quiz_metrics.metric_date IS 'Data das métricas (sem hora)';
COMMENT ON COLUMN quiz_metrics.quizzes_saved IS 'Total de quizzes salvos no dia';
COMMENT ON COLUMN quiz_metrics.quizzes_saved_with_session_id IS 'Quizzes salvos com session_id (fluxo novo)';
COMMENT ON COLUMN quiz_metrics.orders_created IS 'Total de pedidos criados no dia';
COMMENT ON COLUMN quiz_metrics.orders_with_quiz IS 'Pedidos com quiz_id vinculado';
COMMENT ON COLUMN quiz_metrics.orders_without_quiz IS 'Pedidos sem quiz_id (inconsistência)';
COMMENT ON COLUMN quiz_metrics.quizzes_lost IS 'Quizzes que não foram vinculados a pedidos (estimativa)';
COMMENT ON COLUMN quiz_metrics.retry_queue_size IS 'Tamanho da fila de retry no final do dia';

