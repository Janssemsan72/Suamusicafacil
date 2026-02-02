-- ==========================================
-- Refatoração: Tabelas Separadas por Coluna do Kanban
-- Resolve problemas de sincronização criando tabelas físicas separadas
-- ==========================================

-- 1. TABELA: whatsapp_funnel_pending
-- Funis pendentes (status='active' e order.status='pending')
CREATE TABLE IF NOT EXISTS whatsapp_funnel_pending (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  customer_whatsapp TEXT NOT NULL CHECK (customer_whatsapp IS NOT NULL AND LENGTH(TRIM(customer_whatsapp)) > 0),
  customer_email TEXT NOT NULL,
  current_step INTEGER NOT NULL DEFAULT 0,
  last_message_sent_at TIMESTAMPTZ,
  next_message_at TIMESTAMPTZ,
  ab_variant TEXT, -- 'a' ou 'b' para teste A/B
  exit_reason TEXT,
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

-- 2. TABELA: whatsapp_funnel_completed
-- Funis completos (order.status='paid')
CREATE TABLE IF NOT EXISTS whatsapp_funnel_completed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  customer_whatsapp TEXT NOT NULL CHECK (customer_whatsapp IS NOT NULL AND LENGTH(TRIM(customer_whatsapp)) > 0),
  customer_email TEXT NOT NULL,
  current_step INTEGER NOT NULL DEFAULT 0,
  last_message_sent_at TIMESTAMPTZ,
  next_message_at TIMESTAMPTZ,
  ab_variant TEXT,
  exit_reason TEXT,
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

-- 3. TABELA: whatsapp_funnel_exited
-- Funis que saíram (funnel_status='exited' ou 3+ mensagens enviadas)
CREATE TABLE IF NOT EXISTS whatsapp_funnel_exited (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  customer_whatsapp TEXT NOT NULL CHECK (customer_whatsapp IS NOT NULL AND LENGTH(TRIM(customer_whatsapp)) > 0),
  customer_email TEXT NOT NULL,
  current_step INTEGER NOT NULL DEFAULT 0,
  last_message_sent_at TIMESTAMPTZ,
  next_message_at TIMESTAMPTZ,
  ab_variant TEXT,
  exit_reason TEXT NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_funnel_pending_order_id ON whatsapp_funnel_pending(order_id);
CREATE INDEX IF NOT EXISTS idx_funnel_pending_next_message ON whatsapp_funnel_pending(next_message_at) WHERE next_message_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_funnel_pending_order_status ON whatsapp_funnel_pending(order_status);

CREATE INDEX IF NOT EXISTS idx_funnel_completed_order_id ON whatsapp_funnel_completed(order_id);
CREATE INDEX IF NOT EXISTS idx_funnel_completed_order_status ON whatsapp_funnel_completed(order_status);

CREATE INDEX IF NOT EXISTS idx_funnel_exited_order_id ON whatsapp_funnel_exited(order_id);
CREATE INDEX IF NOT EXISTS idx_funnel_exited_exit_reason ON whatsapp_funnel_exited(exit_reason);

-- RLS (Row Level Security)
ALTER TABLE whatsapp_funnel_pending ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_funnel_completed ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_funnel_exited ENABLE ROW LEVEL SECURITY;

-- Políticas RLS: Service role pode tudo
DROP POLICY IF EXISTS "Service role can manage funnel_pending" ON whatsapp_funnel_pending;
CREATE POLICY "Service role can manage funnel_pending" ON whatsapp_funnel_pending
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can manage funnel_completed" ON whatsapp_funnel_completed;
CREATE POLICY "Service role can manage funnel_completed" ON whatsapp_funnel_completed
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can manage funnel_exited" ON whatsapp_funnel_exited;
CREATE POLICY "Service role can manage funnel_exited" ON whatsapp_funnel_exited
  FOR ALL USING (auth.role() = 'service_role');

-- Políticas RLS: Admins podem visualizar tudo
DROP POLICY IF EXISTS "Admins can view funnel_pending" ON whatsapp_funnel_pending;
CREATE POLICY "Admins can view funnel_pending" ON whatsapp_funnel_pending
  FOR SELECT USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role::text = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can view funnel_completed" ON whatsapp_funnel_completed;
CREATE POLICY "Admins can view funnel_completed" ON whatsapp_funnel_completed
  FOR SELECT USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role::text = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can view funnel_exited" ON whatsapp_funnel_exited;
CREATE POLICY "Admins can view funnel_exited" ON whatsapp_funnel_exited
  FOR SELECT USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role::text = 'admin'
    )
  );

-- Políticas RLS: Admins podem excluir
DROP POLICY IF EXISTS "Admins can delete funnel_pending" ON whatsapp_funnel_pending;
CREATE POLICY "Admins can delete funnel_pending" ON whatsapp_funnel_pending
  FOR DELETE USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role::text = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete funnel_completed" ON whatsapp_funnel_completed;
CREATE POLICY "Admins can delete funnel_completed" ON whatsapp_funnel_completed
  FOR DELETE USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role::text = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete funnel_exited" ON whatsapp_funnel_exited;
CREATE POLICY "Admins can delete funnel_exited" ON whatsapp_funnel_exited
  FOR DELETE USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role::text = 'admin'
    )
  );

-- Triggers para updated_at
DROP TRIGGER IF EXISTS update_funnel_pending_updated_at ON whatsapp_funnel_pending;
CREATE TRIGGER update_funnel_pending_updated_at
  BEFORE UPDATE ON whatsapp_funnel_pending
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_funnel_completed_updated_at ON whatsapp_funnel_completed;
CREATE TRIGGER update_funnel_completed_updated_at
  BEFORE UPDATE ON whatsapp_funnel_completed
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_funnel_exited_updated_at ON whatsapp_funnel_exited;
CREATE TRIGGER update_funnel_exited_updated_at
  BEFORE UPDATE ON whatsapp_funnel_exited
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- FUNÇÕES PARA MOVER FUNIS ENTRE TABELAS
-- ==========================================

-- Função auxiliar para sincronizar dados de order e quiz
CREATE OR REPLACE FUNCTION sync_funnel_order_data(
  p_order_id UUID,
  p_quiz_id UUID DEFAULT NULL
)
RETURNS TABLE(
  order_status TEXT,
  order_amount_cents INTEGER,
  order_created_at TIMESTAMPTZ,
  order_plan TEXT,
  quiz_id UUID,
  quiz_about_who TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
  v_quiz RECORD;
BEGIN
  -- Buscar dados do order
  SELECT o.status, o.amount_cents, o.created_at, o.plan, COALESCE(p_quiz_id, o.quiz_id) as quiz_id
  INTO v_order
  FROM orders o
  WHERE o.id = p_order_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', p_order_id;
  END IF;
  
  -- Buscar dados do quiz se quiz_id estiver disponível
  IF v_order.quiz_id IS NOT NULL THEN
    SELECT q.about_who
    INTO v_quiz
    FROM quizzes q
    WHERE q.id = v_order.quiz_id;
  END IF;
  
  RETURN QUERY SELECT
    v_order.status,
    v_order.amount_cents,
    v_order.created_at,
    v_order.plan,
    v_order.quiz_id,
    COALESCE(v_quiz.about_who, '')::TEXT;
END;
$$;

-- Função para mover funil para pending
CREATE OR REPLACE FUNCTION move_funnel_to_pending(p_funnel_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_funnel RECORD;
  v_order_id UUID;
  v_quiz_id_param UUID;
  v_order_status TEXT;
  v_order_amount_cents INTEGER;
  v_order_created_at TIMESTAMPTZ;
  v_order_plan TEXT;
  v_quiz_id UUID;
  v_quiz_about_who TEXT;
  v_new_id UUID;
BEGIN
  -- Buscar funil de qualquer tabela (buscar separadamente para evitar problemas de UNION)
  SELECT * INTO v_funnel FROM whatsapp_funnel_pending WHERE id = p_funnel_id;
  
  IF NOT FOUND THEN
    SELECT * INTO v_funnel FROM whatsapp_funnel_completed WHERE id = p_funnel_id;
  END IF;
  
  IF NOT FOUND THEN
    SELECT * INTO v_funnel FROM whatsapp_funnel_exited WHERE id = p_funnel_id;
  END IF;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Funnel % not found', p_funnel_id;
  END IF;
  
  -- Armazenar valores em variáveis locais
  v_order_id := v_funnel.order_id;
  v_quiz_id_param := v_funnel.quiz_id;
  
  -- Buscar dados diretamente do order e quiz (evitar problema com função que retorna TABLE)
  SELECT 
    o.status, o.amount_cents, o.created_at, o.plan, COALESCE(v_quiz_id_param, o.quiz_id) as quiz_id
  INTO 
    v_order_status, v_order_amount_cents, v_order_created_at, v_order_plan, v_quiz_id
  FROM orders o
  WHERE o.id = v_order_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', v_order_id;
  END IF;
  
  -- Buscar dados do quiz se quiz_id estiver disponível
  IF v_quiz_id IS NOT NULL THEN
    SELECT COALESCE(q.about_who, '')::TEXT
    INTO v_quiz_about_who
    FROM quizzes q
    WHERE q.id = v_quiz_id;
  ELSE
    v_quiz_about_who := '';
  END IF;
  
  -- Remover de tabela atual
  DELETE FROM whatsapp_funnel_pending WHERE id = p_funnel_id;
  DELETE FROM whatsapp_funnel_completed WHERE id = p_funnel_id;
  DELETE FROM whatsapp_funnel_exited WHERE id = p_funnel_id;
  
  -- Inserir em pending
  INSERT INTO whatsapp_funnel_pending (
    id, order_id, customer_whatsapp, customer_email,
    current_step, last_message_sent_at, next_message_at,
    ab_variant, exit_reason, created_at, updated_at,
    order_status, order_amount_cents, order_created_at,
    order_plan, quiz_id, quiz_about_who
  ) VALUES (
    v_funnel.id, v_funnel.order_id, v_funnel.customer_whatsapp, v_funnel.customer_email,
    v_funnel.current_step, v_funnel.last_message_sent_at, v_funnel.next_message_at,
    v_funnel.ab_variant, NULL, v_funnel.created_at, NOW(),
    v_order_status, v_order_amount_cents, v_order_created_at,
    v_order_plan, v_quiz_id, v_quiz_about_who
  )
  RETURNING id INTO v_new_id;
  
  RETURN v_new_id;
END;
$$;

-- Função para mover funil para completed
CREATE OR REPLACE FUNCTION move_funnel_to_completed(p_funnel_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_funnel RECORD;
  v_order_id UUID;
  v_quiz_id_param UUID;
  v_order_status TEXT;
  v_order_amount_cents INTEGER;
  v_order_created_at TIMESTAMPTZ;
  v_order_plan TEXT;
  v_quiz_id UUID;
  v_quiz_about_who TEXT;
  v_new_id UUID;
BEGIN
  -- Buscar funil de qualquer tabela (buscar separadamente para evitar problemas de UNION)
  SELECT * INTO v_funnel FROM whatsapp_funnel_pending WHERE id = p_funnel_id;
  
  IF NOT FOUND THEN
    SELECT * INTO v_funnel FROM whatsapp_funnel_completed WHERE id = p_funnel_id;
  END IF;
  
  IF NOT FOUND THEN
    SELECT * INTO v_funnel FROM whatsapp_funnel_exited WHERE id = p_funnel_id;
  END IF;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Funnel % not found', p_funnel_id;
  END IF;
  
  -- Armazenar valores em variáveis locais
  v_order_id := v_funnel.order_id;
  v_quiz_id_param := v_funnel.quiz_id;
  
  -- Buscar dados diretamente do order e quiz (evitar problema com função que retorna TABLE)
  SELECT 
    o.status, o.amount_cents, o.created_at, o.plan, COALESCE(v_quiz_id_param, o.quiz_id) as quiz_id
  INTO 
    v_order_status, v_order_amount_cents, v_order_created_at, v_order_plan, v_quiz_id
  FROM orders o
  WHERE o.id = v_order_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', v_order_id;
  END IF;
  
  -- Buscar dados do quiz se quiz_id estiver disponível
  IF v_quiz_id IS NOT NULL THEN
    SELECT COALESCE(q.about_who, '')::TEXT
    INTO v_quiz_about_who
    FROM quizzes q
    WHERE q.id = v_quiz_id;
  ELSE
    v_quiz_about_who := '';
  END IF;
  
  -- Atualizar order para paid se ainda não estiver
  -- IMPORTANTE: Se paid_at não existir, usar created_at (data de criação da ordem)
  UPDATE orders
  SET status = 'paid', paid_at = COALESCE(paid_at, created_at), updated_at = NOW()
  WHERE id = v_funnel.order_id AND status != 'paid';
  
  -- Remover de tabela atual
  DELETE FROM whatsapp_funnel_pending WHERE id = p_funnel_id;
  DELETE FROM whatsapp_funnel_completed WHERE id = p_funnel_id;
  DELETE FROM whatsapp_funnel_exited WHERE id = p_funnel_id;
  
  -- Inserir em completed
  INSERT INTO whatsapp_funnel_completed (
    id, order_id, customer_whatsapp, customer_email,
    current_step, last_message_sent_at, next_message_at,
    ab_variant, exit_reason, completed_at, created_at, updated_at,
    order_status, order_amount_cents, order_created_at,
    order_plan, quiz_id, quiz_about_who
  ) VALUES (
    v_funnel.id, v_funnel.order_id, v_funnel.customer_whatsapp, v_funnel.customer_email,
    v_funnel.current_step, v_funnel.last_message_sent_at, NULL,
    v_funnel.ab_variant, 'paid', NOW(), v_funnel.created_at, NOW(),
    'paid', v_order_amount_cents, v_order_created_at,
    v_order_plan, v_quiz_id, v_quiz_about_who
  )
  RETURNING id INTO v_new_id;
  
  RETURN v_new_id;
END;
$$;

-- Função para mover funil para exited
CREATE OR REPLACE FUNCTION move_funnel_to_exited(p_funnel_id UUID, p_exit_reason TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_funnel RECORD;
  v_order_id UUID;
  v_quiz_id_param UUID;
  v_order_status TEXT;
  v_order_amount_cents INTEGER;
  v_order_created_at TIMESTAMPTZ;
  v_order_plan TEXT;
  v_quiz_id UUID;
  v_quiz_about_who TEXT;
  v_new_id UUID;
BEGIN
  -- Buscar funil de qualquer tabela (buscar separadamente para evitar problemas de UNION)
  SELECT * INTO v_funnel FROM whatsapp_funnel_pending WHERE id = p_funnel_id;
  
  IF NOT FOUND THEN
    SELECT * INTO v_funnel FROM whatsapp_funnel_completed WHERE id = p_funnel_id;
  END IF;
  
  IF NOT FOUND THEN
    SELECT * INTO v_funnel FROM whatsapp_funnel_exited WHERE id = p_funnel_id;
  END IF;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Funnel % not found', p_funnel_id;
  END IF;
  
  -- Armazenar valores em variáveis locais
  v_order_id := v_funnel.order_id;
  v_quiz_id_param := v_funnel.quiz_id;
  
  -- Buscar dados diretamente do order e quiz (evitar problema com função que retorna TABLE)
  SELECT 
    o.status, o.amount_cents, o.created_at, o.plan, COALESCE(v_quiz_id_param, o.quiz_id) as quiz_id
  INTO 
    v_order_status, v_order_amount_cents, v_order_created_at, v_order_plan, v_quiz_id
  FROM orders o
  WHERE o.id = v_order_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', v_order_id;
  END IF;
  
  -- Buscar dados do quiz se quiz_id estiver disponível
  IF v_quiz_id IS NOT NULL THEN
    SELECT COALESCE(q.about_who, '')::TEXT
    INTO v_quiz_about_who
    FROM quizzes q
    WHERE q.id = v_quiz_id;
  ELSE
    v_quiz_about_who := '';
  END IF;
  
  -- Remover de tabela atual
  DELETE FROM whatsapp_funnel_pending WHERE id = p_funnel_id;
  DELETE FROM whatsapp_funnel_completed WHERE id = p_funnel_id;
  DELETE FROM whatsapp_funnel_exited WHERE id = p_funnel_id;
  
  -- Inserir em exited
  INSERT INTO whatsapp_funnel_exited (
    id, order_id, customer_whatsapp, customer_email,
    current_step, last_message_sent_at, next_message_at,
    ab_variant, exit_reason, exited_at, created_at, updated_at,
    order_status, order_amount_cents, order_created_at,
    order_plan, quiz_id, quiz_about_who
  ) VALUES (
    v_funnel.id, v_funnel.order_id, v_funnel.customer_whatsapp, v_funnel.customer_email,
    v_funnel.current_step, v_funnel.last_message_sent_at, NULL,
    v_funnel.ab_variant, p_exit_reason, NOW(), v_funnel.created_at, NOW(),
    v_order_status, v_order_amount_cents, v_order_created_at,
    v_order_plan, v_quiz_id, v_quiz_about_who
  )
  RETURNING id INTO v_new_id;
  
  RETURN v_new_id;
END;
$$;

-- Função para marcar funil e ordem como pagos simultaneamente
CREATE OR REPLACE FUNCTION mark_funnel_and_order_as_paid(p_order_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_funnel RECORD;
  v_funnel_id UUID;
BEGIN
  -- Atualizar order para paid
  -- IMPORTANTE: Se paid_at não existir, usar created_at (data de criação da ordem)
  UPDATE orders
  SET 
    status = 'paid',
    paid_at = COALESCE(paid_at, created_at),
    updated_at = NOW()
  WHERE id = p_order_id AND status != 'paid';
  
  -- Buscar funil em pending
  SELECT id INTO v_funnel_id
  FROM whatsapp_funnel_pending
  WHERE order_id = p_order_id
  LIMIT 1;
  
  -- Se encontrou funil, mover para completed
  IF v_funnel_id IS NOT NULL THEN
    PERFORM move_funnel_to_completed(v_funnel_id);
    
    -- Cancelar mensagens pendentes
    UPDATE whatsapp_messages
    SET 
      status = 'cancelled',
      updated_at = NOW()
    WHERE funnel_id = v_funnel_id
      AND status = 'pending';
  END IF;
  
  RETURN v_funnel_id;
END;
$$;

-- Função para sincronizar dados de um funil específico
CREATE OR REPLACE FUNCTION sync_funnel_order_data_by_id(p_funnel_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_funnel RECORD;
  v_table_name TEXT;
  v_order_id UUID;
  v_quiz_id_param UUID;
  v_order_status TEXT;
  v_order_amount_cents INTEGER;
  v_order_created_at TIMESTAMPTZ;
  v_order_plan TEXT;
  v_quiz_id UUID;
  v_quiz_about_who TEXT;
BEGIN
  -- Identificar em qual tabela está o funil
  SELECT 'pending' INTO v_table_name
  FROM whatsapp_funnel_pending WHERE id = p_funnel_id;
  
  IF NOT FOUND THEN
    SELECT 'completed' INTO v_table_name
    FROM whatsapp_funnel_completed WHERE id = p_funnel_id;
    
    IF NOT FOUND THEN
      SELECT 'exited' INTO v_table_name
      FROM whatsapp_funnel_exited WHERE id = p_funnel_id;
      
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Funnel % not found', p_funnel_id;
      END IF;
    END IF;
  END IF;
  
  -- Buscar funil
  IF v_table_name = 'pending' THEN
    SELECT * INTO v_funnel FROM whatsapp_funnel_pending WHERE id = p_funnel_id;
  ELSIF v_table_name = 'completed' THEN
    SELECT * INTO v_funnel FROM whatsapp_funnel_completed WHERE id = p_funnel_id;
  ELSE
    SELECT * INTO v_funnel FROM whatsapp_funnel_exited WHERE id = p_funnel_id;
  END IF;
  
  -- Armazenar valores em variáveis locais
  v_order_id := v_funnel.order_id;
  v_quiz_id_param := v_funnel.quiz_id;
  
  -- Buscar dados diretamente do order e quiz (evitar problema com função que retorna TABLE)
  SELECT 
    o.status, o.amount_cents, o.created_at, o.plan, COALESCE(v_quiz_id_param, o.quiz_id) as quiz_id
  INTO 
    v_order_status, v_order_amount_cents, v_order_created_at, v_order_plan, v_quiz_id
  FROM orders o
  WHERE o.id = v_order_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', v_order_id;
  END IF;
  
  -- Buscar dados do quiz se quiz_id estiver disponível
  IF v_quiz_id IS NOT NULL THEN
    SELECT COALESCE(q.about_who, '')::TEXT
    INTO v_quiz_about_who
    FROM quizzes q
    WHERE q.id = v_quiz_id;
  ELSE
    v_quiz_about_who := '';
  END IF;
  
  -- Atualizar campos duplicados
  IF v_table_name = 'pending' THEN
    UPDATE whatsapp_funnel_pending
    SET 
      order_status = v_order_status,
      order_amount_cents = v_order_amount_cents,
      order_created_at = v_order_created_at,
      order_plan = v_order_plan,
      quiz_id = v_quiz_id,
      quiz_about_who = v_quiz_about_who,
      updated_at = NOW()
    WHERE id = p_funnel_id;
  ELSIF v_table_name = 'completed' THEN
    UPDATE whatsapp_funnel_completed
    SET 
      order_status = v_order_status,
      order_amount_cents = v_order_amount_cents,
      order_created_at = v_order_created_at,
      order_plan = v_order_plan,
      quiz_id = v_quiz_id,
      quiz_about_who = v_quiz_about_who,
      updated_at = NOW()
    WHERE id = p_funnel_id;
  ELSE
    UPDATE whatsapp_funnel_exited
    SET 
      order_status = v_order_status,
      order_amount_cents = v_order_amount_cents,
      order_created_at = v_order_created_at,
      order_plan = v_order_plan,
      quiz_id = v_quiz_id,
      quiz_about_who = v_quiz_about_who,
      updated_at = NOW()
    WHERE id = p_funnel_id;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- View unificada para compatibilidade com whatsapp_messages
-- A foreign key de whatsapp_messages.funnel_id precisa referenciar uma tabela
-- Criamos uma view que combina as 3 tabelas para manter compatibilidade
CREATE OR REPLACE VIEW whatsapp_funnel_unified AS
SELECT 
  id, order_id, customer_whatsapp, customer_email,
  'pending' as source_table,
  current_step, last_message_sent_at, next_message_at,
  ab_variant, exit_reason, created_at, updated_at,
  order_status, order_amount_cents, order_created_at,
  order_plan, quiz_id, quiz_about_who
FROM whatsapp_funnel_pending
UNION ALL
SELECT 
  id, order_id, customer_whatsapp, customer_email,
  'completed' as source_table,
  current_step, last_message_sent_at, next_message_at,
  ab_variant, exit_reason, created_at, updated_at,
  order_status, order_amount_cents, order_created_at,
  order_plan, quiz_id, quiz_about_who
FROM whatsapp_funnel_completed
UNION ALL
SELECT 
  id, order_id, customer_whatsapp, customer_email,
  'exited' as source_table,
  current_step, last_message_sent_at, next_message_at,
  ab_variant, exit_reason, created_at, updated_at,
  order_status, order_amount_cents, order_created_at,
  order_plan, quiz_id, quiz_about_who
FROM whatsapp_funnel_exited;

-- Atualizar foreign key de whatsapp_messages para usar a view
-- Na verdade, vamos manter a foreign key apontando para whatsapp_funnel original
-- e criar triggers para garantir que o id existe em uma das 3 tabelas
-- Por enquanto, vamos manter a estrutura atual e atualizar as Edge Functions

-- Garantir permissões
GRANT EXECUTE ON FUNCTION move_funnel_to_pending(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION move_funnel_to_completed(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION move_funnel_to_exited(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION mark_funnel_and_order_as_paid(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION sync_funnel_order_data(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION sync_funnel_order_data_by_id(UUID) TO authenticated, service_role;

-- Comentários
COMMENT ON TABLE whatsapp_funnel_pending IS 'Funis WhatsApp pendentes (status active, order pending)';
COMMENT ON TABLE whatsapp_funnel_completed IS 'Funis WhatsApp completos (order paid)';
COMMENT ON TABLE whatsapp_funnel_exited IS 'Funis WhatsApp que saíram (exited ou 3+ mensagens)';
COMMENT ON FUNCTION mark_funnel_and_order_as_paid(UUID) IS 'Marca ordem como paga e move funil para completed simultaneamente';

