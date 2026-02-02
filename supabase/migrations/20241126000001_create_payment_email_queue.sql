-- ==========================================
-- Criar tabela de fila para processamento assíncrono de emails de pagamento
-- ==========================================
-- Esta tabela armazena pedidos que precisam receber email de confirmação
-- Processamento assíncrono evita timeouts e rate limiting em alta demanda
-- ==========================================

CREATE TABLE IF NOT EXISTS payment_email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_created_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 5,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  CONSTRAINT payment_email_queue_status_check CHECK (status IN ('pending', 'processing', 'sent', 'failed'))
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_payment_email_queue_status ON payment_email_queue(status) WHERE status IN ('pending', 'failed');
CREATE INDEX IF NOT EXISTS idx_payment_email_queue_order_id ON payment_email_queue(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_email_queue_created_at ON payment_email_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_payment_email_queue_order_created_at ON payment_email_queue(order_created_at);

-- Índice composto para busca eficiente de itens pendentes
CREATE INDEX IF NOT EXISTS idx_payment_email_queue_pending ON payment_email_queue(status, created_at) WHERE status = 'pending';

-- Comentários
COMMENT ON TABLE payment_email_queue IS 'Fila assíncrona para processamento de emails de confirmação de pagamento. Garante que todos os pedidos pagos recebam email mesmo sob alta demanda.';
COMMENT ON COLUMN payment_email_queue.order_id IS 'ID do pedido que precisa receber email';
COMMENT ON COLUMN payment_email_queue.order_created_at IS 'Data de criação do pedido (usado para validação: apenas pedidos >= 2024-11-26)';
COMMENT ON COLUMN payment_email_queue.status IS 'Status do processamento: pending, processing, sent, failed';
COMMENT ON COLUMN payment_email_queue.retry_count IS 'Número de tentativas de envio já realizadas';
COMMENT ON COLUMN payment_email_queue.max_retries IS 'Número máximo de tentativas permitidas (padrão: 5)';
COMMENT ON COLUMN payment_email_queue.last_error IS 'Última mensagem de erro (se houver)';










