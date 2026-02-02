-- Migration: Criar tabela para logs do webhook do Cakto
-- Permite monitorar e analisar todas as chamadas do webhook

CREATE TABLE IF NOT EXISTS cakto_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Dados recebidos do webhook
  webhook_body JSONB,
  transaction_id TEXT,
  order_id_from_webhook UUID,
  status_received TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  amount_cents INTEGER,
  
  -- Resultado do processamento
  order_found BOOLEAN DEFAULT FALSE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  order_status_before TEXT,
  order_status_after TEXT,
  processing_success BOOLEAN DEFAULT FALSE,
  error_message TEXT,
  
  -- Estratégia usada para encontrar o pedido
  strategy_used TEXT,
  
  -- Metadados
  processing_time_ms INTEGER,
  ip_address TEXT,
  user_agent TEXT
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_cakto_webhook_logs_created_at ON cakto_webhook_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cakto_webhook_logs_transaction_id ON cakto_webhook_logs(transaction_id);
CREATE INDEX IF NOT EXISTS idx_cakto_webhook_logs_order_id ON cakto_webhook_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_cakto_webhook_logs_order_found ON cakto_webhook_logs(order_found);
CREATE INDEX IF NOT EXISTS idx_cakto_webhook_logs_processing_success ON cakto_webhook_logs(processing_success);

-- Comentários
COMMENT ON TABLE cakto_webhook_logs IS 'Logs de todas as chamadas do webhook do Cakto para monitoramento e análise';
COMMENT ON COLUMN cakto_webhook_logs.webhook_body IS 'Body completo recebido do webhook (JSON)';
COMMENT ON COLUMN cakto_webhook_logs.strategy_used IS 'Estratégia usada para encontrar o pedido (order_id, transaction_id, email, etc.)';
COMMENT ON COLUMN cakto_webhook_logs.processing_time_ms IS 'Tempo de processamento em milissegundos';

