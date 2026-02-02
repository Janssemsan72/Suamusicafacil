-- ==========================================
-- Criar Tabelas de Funil de Email
-- Similar ao funil de WhatsApp, mas para emails
-- ==========================================

-- 1. TABELA: email_funnel_pending
-- Funis de email pendentes (order.status='pending')
CREATE TABLE IF NOT EXISTS email_funnel_pending (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  customer_email TEXT NOT NULL CHECK (customer_email IS NOT NULL AND LENGTH(TRIM(customer_email)) > 0),
  current_step INTEGER NOT NULL DEFAULT 0,
  last_email_sent_at TIMESTAMPTZ,
  next_email_at TIMESTAMPTZ,
  ab_variant TEXT, -- 'a' ou 'b' para teste A/B
  exit_reason TEXT,
  is_paused BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Campos duplicados para evitar joins
  order_status TEXT NOT NULL DEFAULT 'pending',
  order_amount_cents INTEGER,
  order_created_at TIMESTAMPTZ,
  order_plan TEXT,
  quiz_id UUID,
  quiz_about_who TEXT,
  UNIQUE(order_id)
);

-- 2. TABELA: email_funnel_completed
-- Funis de email completos (order.status='paid')
CREATE TABLE IF NOT EXISTS email_funnel_completed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  customer_email TEXT NOT NULL CHECK (customer_email IS NOT NULL AND LENGTH(TRIM(customer_email)) > 0),
  current_step INTEGER NOT NULL DEFAULT 0,
  last_email_sent_at TIMESTAMPTZ,
  next_email_at TIMESTAMPTZ,
  ab_variant TEXT,
  exit_reason TEXT,
  is_paused BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Campos duplicados para evitar joins
  order_status TEXT NOT NULL DEFAULT 'paid',
  order_amount_cents INTEGER,
  order_created_at TIMESTAMPTZ,
  order_plan TEXT,
  quiz_id UUID,
  quiz_about_who TEXT,
  UNIQUE(order_id)
);

-- 3. TABELA: email_funnel_exited
-- Funis de email que saíram (timeout ou 4+ emails enviados)
CREATE TABLE IF NOT EXISTS email_funnel_exited (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  customer_email TEXT NOT NULL CHECK (customer_email IS NOT NULL AND LENGTH(TRIM(customer_email)) > 0),
  current_step INTEGER NOT NULL DEFAULT 0,
  last_email_sent_at TIMESTAMPTZ,
  next_email_at TIMESTAMPTZ,
  ab_variant TEXT,
  exit_reason TEXT NOT NULL,
  is_paused BOOLEAN NOT NULL DEFAULT TRUE, -- Funis exited começam pausados
  exited_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Campos duplicados para evitar joins
  order_status TEXT NOT NULL,
  order_amount_cents INTEGER,
  order_created_at TIMESTAMPTZ,
  order_plan TEXT,
  quiz_id UUID,
  quiz_about_who TEXT,
  UNIQUE(order_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_email_funnel_pending_order_id ON email_funnel_pending(order_id);
CREATE INDEX IF NOT EXISTS idx_email_funnel_pending_next_email ON email_funnel_pending(next_email_at) WHERE next_email_at IS NOT NULL AND is_paused = FALSE;
CREATE INDEX IF NOT EXISTS idx_email_funnel_pending_order_status ON email_funnel_pending(order_status);

CREATE INDEX IF NOT EXISTS idx_email_funnel_completed_order_id ON email_funnel_completed(order_id);
CREATE INDEX IF NOT EXISTS idx_email_funnel_completed_order_status ON email_funnel_completed(order_status);

CREATE INDEX IF NOT EXISTS idx_email_funnel_exited_order_id ON email_funnel_exited(order_id);
CREATE INDEX IF NOT EXISTS idx_email_funnel_exited_exit_reason ON email_funnel_exited(exit_reason);

-- RLS (Row Level Security)
ALTER TABLE email_funnel_pending ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_funnel_completed ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_funnel_exited ENABLE ROW LEVEL SECURITY;

-- Políticas RLS: Service role pode tudo
DROP POLICY IF EXISTS "Service role can manage email_funnel_pending" ON email_funnel_pending;
CREATE POLICY "Service role can manage email_funnel_pending" ON email_funnel_pending
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can manage email_funnel_completed" ON email_funnel_completed;
CREATE POLICY "Service role can manage email_funnel_completed" ON email_funnel_completed
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can manage email_funnel_exited" ON email_funnel_exited;
CREATE POLICY "Service role can manage email_funnel_exited" ON email_funnel_exited
  FOR ALL USING (auth.role() = 'service_role');

-- Políticas RLS: Admins podem visualizar tudo
DROP POLICY IF EXISTS "Admins can view email_funnel_pending" ON email_funnel_pending;
CREATE POLICY "Admins can view email_funnel_pending" ON email_funnel_pending
  FOR SELECT USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role::text = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can view email_funnel_completed" ON email_funnel_completed;
CREATE POLICY "Admins can view email_funnel_completed" ON email_funnel_completed
  FOR SELECT USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role::text = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can view email_funnel_exited" ON email_funnel_exited;
CREATE POLICY "Admins can view email_funnel_exited" ON email_funnel_exited
  FOR SELECT USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role::text = 'admin'
    )
  );

-- Políticas RLS: Admins podem excluir
DROP POLICY IF EXISTS "Admins can delete email_funnel_pending" ON email_funnel_pending;
CREATE POLICY "Admins can delete email_funnel_pending" ON email_funnel_pending
  FOR DELETE USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role::text = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete email_funnel_completed" ON email_funnel_completed;
CREATE POLICY "Admins can delete email_funnel_completed" ON email_funnel_completed
  FOR DELETE USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role::text = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete email_funnel_exited" ON email_funnel_exited;
CREATE POLICY "Admins can delete email_funnel_exited" ON email_funnel_exited
  FOR DELETE USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role::text = 'admin'
    )
  );

-- Triggers para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_email_funnel_pending_updated_at ON email_funnel_pending;
CREATE TRIGGER update_email_funnel_pending_updated_at
  BEFORE UPDATE ON email_funnel_pending
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_email_funnel_completed_updated_at ON email_funnel_completed;
CREATE TRIGGER update_email_funnel_completed_updated_at
  BEFORE UPDATE ON email_funnel_completed
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_email_funnel_exited_updated_at ON email_funnel_exited;
CREATE TRIGGER update_email_funnel_exited_updated_at
  BEFORE UPDATE ON email_funnel_exited
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE email_funnel_pending IS 'Funis de email ativos com pedidos pendentes';
COMMENT ON TABLE email_funnel_completed IS 'Funis de email completos (pedido pago)';
COMMENT ON TABLE email_funnel_exited IS 'Funis de email que saíram (timeout ou 4+ emails enviados)';

