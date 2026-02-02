-- Migration: Criar tabela para rastrear eventos n8n já enviados
-- Garante que cada evento seja enviado apenas uma vez por pedido

CREATE TABLE IF NOT EXISTS n8n_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('pending_7min', 'paid')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  webhook_url TEXT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Garantir que cada combinação de order_id + event_type seja única
  UNIQUE(order_id, event_type)
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_n8n_webhook_events_order_id ON n8n_webhook_events(order_id);
CREATE INDEX IF NOT EXISTS idx_n8n_webhook_events_event_type ON n8n_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_n8n_webhook_events_sent_at ON n8n_webhook_events(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_n8n_webhook_events_order_event ON n8n_webhook_events(order_id, event_type);

-- Comentários
COMMENT ON TABLE n8n_webhook_events IS 'Rastreia eventos n8n já enviados para garantir que cada evento seja enviado apenas uma vez por pedido';
COMMENT ON COLUMN n8n_webhook_events.order_id IS 'ID do pedido';
COMMENT ON COLUMN n8n_webhook_events.event_type IS 'Tipo de evento: pending_7min ou paid';
COMMENT ON COLUMN n8n_webhook_events.sent_at IS 'Data/hora em que o evento foi enviado';
COMMENT ON COLUMN n8n_webhook_events.webhook_url IS 'URL do webhook para onde o evento foi enviado';
COMMENT ON COLUMN n8n_webhook_events.success IS 'Indica se o envio foi bem-sucedido';
COMMENT ON COLUMN n8n_webhook_events.error_message IS 'Mensagem de erro caso o envio tenha falhado';

-- RLS (Row Level Security) - permitir acesso apenas para service_role
ALTER TABLE n8n_webhook_events ENABLE ROW LEVEL SECURITY;

-- Política para service_role (Edge Functions usam service_role)
CREATE POLICY "Service role can manage n8n_webhook_events"
ON n8n_webhook_events
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');






