-- ==========================================
-- CRIAR TABELA DE FILA DE EMAILS
-- ==========================================
-- Esta tabela armazena emails pendentes para envio assíncrono
-- com retry automático e backoff exponencial

CREATE TABLE IF NOT EXISTS email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_type TEXT NOT NULL DEFAULT 'music_released',
  order_id UUID NOT NULL,
  song_id UUID NOT NULL,
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, sent, failed
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 5,
  next_retry_at TIMESTAMPTZ DEFAULT NOW(),
  last_error TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para buscar emails pendentes rapidamente
CREATE INDEX IF NOT EXISTS idx_email_queue_pending 
ON email_queue(status, next_retry_at) 
WHERE status = 'pending';

-- Índice para buscar por order_id
CREATE INDEX IF NOT EXISTS idx_email_queue_order_id 
ON email_queue(order_id);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_email_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_email_queue_updated_at
  BEFORE UPDATE ON email_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_email_queue_updated_at();

-- Comentários para documentação
COMMENT ON TABLE email_queue IS 'Fila de emails para envio assíncrono com retry automático';
COMMENT ON COLUMN email_queue.status IS 'Status: pending (aguardando), processing (enviando), sent (enviado), failed (falhou após max_retries)';
COMMENT ON COLUMN email_queue.next_retry_at IS 'Próxima tentativa de envio (para implementar backoff exponencial)';
COMMENT ON COLUMN email_queue.retry_count IS 'Número de tentativas já realizadas';

