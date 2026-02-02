-- Migration: Criar tabela cakto_webhooks para armazenar webhooks processados
-- Esta tabela é necessária para o trigger trigger_validate_cakto_payment validar webhooks válidos

CREATE TABLE IF NOT EXISTS cakto_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Referência ao pedido
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  
  -- Dados da transação
  transaction_id TEXT,
  event_type TEXT,
  status TEXT, -- 'approved', 'refused', 'cancelled', 'failed'
  
  -- Dados financeiros
  amount DECIMAL(10, 2),
  amount_cents INTEGER,
  currency TEXT DEFAULT 'BRL',
  
  -- Dados do cliente
  customer_email TEXT,
  customer_phone TEXT,
  customer_name TEXT,
  customer_document TEXT,
  
  -- Dados do produto
  product_id TEXT,
  product_name TEXT,
  
  -- Dados completos do webhook
  webhook_data JSONB,
  headers JSONB,
  signature TEXT,
  
  -- Metadados de processamento
  ip_address TEXT,
  user_agent TEXT,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  processing_error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_cakto_webhooks_order_id ON cakto_webhooks(order_id);
CREATE INDEX IF NOT EXISTS idx_cakto_webhooks_transaction_id ON cakto_webhooks(transaction_id);
CREATE INDEX IF NOT EXISTS idx_cakto_webhooks_status ON cakto_webhooks(status);
CREATE INDEX IF NOT EXISTS idx_cakto_webhooks_event_type ON cakto_webhooks(event_type);
CREATE INDEX IF NOT EXISTS idx_cakto_webhooks_processed ON cakto_webhooks(processed);
CREATE INDEX IF NOT EXISTS idx_cakto_webhooks_received_at ON cakto_webhooks(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_cakto_webhooks_customer_email ON cakto_webhooks(customer_email);
CREATE INDEX IF NOT EXISTS idx_cakto_webhooks_webhook_data ON cakto_webhooks USING GIN(webhook_data);

-- Índice composto para validação rápida (usado pelo trigger)
CREATE INDEX IF NOT EXISTS idx_cakto_webhooks_order_processed_status 
  ON cakto_webhooks(order_id, processed, status) 
  WHERE processed = true AND status = 'approved';

CREATE INDEX IF NOT EXISTS idx_cakto_webhooks_transaction_processed_status 
  ON cakto_webhooks(transaction_id, processed, status) 
  WHERE processed = true AND status = 'approved';

-- Comentários
COMMENT ON TABLE cakto_webhooks IS 'Armazena todos os webhooks recebidos da Cakto para validação e auditoria';
COMMENT ON COLUMN cakto_webhooks.processed IS 'Indica se o webhook foi processado com sucesso';
COMMENT ON COLUMN cakto_webhooks.status IS 'Status do pagamento: approved, refused, cancelled, failed';
COMMENT ON COLUMN cakto_webhooks.webhook_data IS 'Dados completos do webhook em formato JSONB';

