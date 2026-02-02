-- ==========================================
-- Criar Funções RPC para Gerenciar Funil de Email
-- Similar às funções do funil de WhatsApp
-- ==========================================

-- Função auxiliar para sincronizar dados de order e quiz
CREATE OR REPLACE FUNCTION sync_email_funnel_order_data(
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

-- Função para mover funil de email para pending
CREATE OR REPLACE FUNCTION move_email_funnel_to_pending(p_funnel_id UUID)
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
  -- Buscar funil de qualquer tabela
  SELECT * INTO v_funnel FROM email_funnel_pending WHERE id = p_funnel_id;
  
  IF NOT FOUND THEN
    SELECT * INTO v_funnel FROM email_funnel_completed WHERE id = p_funnel_id;
  END IF;
  
  IF NOT FOUND THEN
    SELECT * INTO v_funnel FROM email_funnel_exited WHERE id = p_funnel_id;
  END IF;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Email funnel % not found', p_funnel_id;
  END IF;
  
  -- Armazenar valores em variáveis locais
  v_order_id := v_funnel.order_id;
  v_quiz_id_param := v_funnel.quiz_id;
  
  -- Buscar dados diretamente do order e quiz
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
  DELETE FROM email_funnel_pending WHERE id = p_funnel_id;
  DELETE FROM email_funnel_completed WHERE id = p_funnel_id;
  DELETE FROM email_funnel_exited WHERE id = p_funnel_id;
  
  -- Inserir em pending
  INSERT INTO email_funnel_pending (
    id, order_id, customer_email,
    current_step, last_email_sent_at, next_email_at,
    ab_variant, exit_reason, is_paused, created_at, updated_at,
    order_status, order_amount_cents, order_created_at,
    order_plan, quiz_id, quiz_about_who
  ) VALUES (
    v_funnel.id, v_funnel.order_id, v_funnel.customer_email,
    v_funnel.current_step, v_funnel.last_email_sent_at, v_funnel.next_email_at,
    v_funnel.ab_variant, NULL, FALSE, v_funnel.created_at, NOW(),
    v_order_status, v_order_amount_cents, v_order_created_at,
    v_order_plan, v_quiz_id, v_quiz_about_who
  )
  RETURNING id INTO v_new_id;
  
  RETURN v_new_id;
END;
$$;

-- Função para mover funil de email para completed
CREATE OR REPLACE FUNCTION move_email_funnel_to_completed(p_funnel_id UUID)
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
  -- Buscar funil de qualquer tabela
  SELECT * INTO v_funnel FROM email_funnel_pending WHERE id = p_funnel_id;
  
  IF NOT FOUND THEN
    SELECT * INTO v_funnel FROM email_funnel_completed WHERE id = p_funnel_id;
  END IF;
  
  IF NOT FOUND THEN
    SELECT * INTO v_funnel FROM email_funnel_exited WHERE id = p_funnel_id;
  END IF;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Email funnel % not found', p_funnel_id;
  END IF;
  
  -- Armazenar valores em variáveis locais
  v_order_id := v_funnel.order_id;
  v_quiz_id_param := v_funnel.quiz_id;
  
  -- Buscar dados diretamente do order e quiz
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
  DELETE FROM email_funnel_pending WHERE id = p_funnel_id;
  DELETE FROM email_funnel_completed WHERE id = p_funnel_id;
  DELETE FROM email_funnel_exited WHERE id = p_funnel_id;
  
  -- Inserir em completed
  INSERT INTO email_funnel_completed (
    id, order_id, customer_email,
    current_step, last_email_sent_at, next_email_at,
    ab_variant, exit_reason, is_paused, completed_at, created_at, updated_at,
    order_status, order_amount_cents, order_created_at,
    order_plan, quiz_id, quiz_about_who
  ) VALUES (
    v_funnel.id, v_funnel.order_id, v_funnel.customer_email,
    v_funnel.current_step, v_funnel.last_email_sent_at, v_funnel.next_email_at,
    v_funnel.ab_variant, NULL, FALSE, NOW(), v_funnel.created_at, NOW(),
    v_order_status, v_order_amount_cents, v_order_created_at,
    v_order_plan, v_quiz_id, v_quiz_about_who
  )
  RETURNING id INTO v_new_id;
  
  RETURN v_new_id;
END;
$$;

-- Função para mover funil de email para exited
CREATE OR REPLACE FUNCTION move_email_funnel_to_exited(p_funnel_id UUID, p_exit_reason TEXT)
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
  -- Buscar funil de qualquer tabela
  SELECT * INTO v_funnel FROM email_funnel_pending WHERE id = p_funnel_id;
  
  IF NOT FOUND THEN
    SELECT * INTO v_funnel FROM email_funnel_completed WHERE id = p_funnel_id;
  END IF;
  
  IF NOT FOUND THEN
    SELECT * INTO v_funnel FROM email_funnel_exited WHERE id = p_funnel_id;
  END IF;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Email funnel % not found', p_funnel_id;
  END IF;
  
  -- Armazenar valores em variáveis locais
  v_order_id := v_funnel.order_id;
  v_quiz_id_param := v_funnel.quiz_id;
  
  -- Buscar dados diretamente do order e quiz
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
  DELETE FROM email_funnel_pending WHERE id = p_funnel_id;
  DELETE FROM email_funnel_completed WHERE id = p_funnel_id;
  DELETE FROM email_funnel_exited WHERE id = p_funnel_id;
  
  -- Inserir em exited
  INSERT INTO email_funnel_exited (
    id, order_id, customer_email,
    current_step, last_email_sent_at, next_email_at,
    ab_variant, exit_reason, is_paused, exited_at, created_at, updated_at,
    order_status, order_amount_cents, order_created_at,
    order_plan, quiz_id, quiz_about_who
  ) VALUES (
    v_funnel.id, v_funnel.order_id, v_funnel.customer_email,
    v_funnel.current_step, v_funnel.last_email_sent_at, v_funnel.next_email_at,
    v_funnel.ab_variant, p_exit_reason, TRUE, NOW(), v_funnel.created_at, NOW(),
    v_order_status, v_order_amount_cents, v_order_created_at,
    v_order_plan, v_quiz_id, v_quiz_about_who
  )
  RETURNING id INTO v_new_id;
  
  RETURN v_new_id;
END;
$$;

-- Função para atualizar dados do order no funil de email
CREATE OR REPLACE FUNCTION update_email_funnel_order_data(p_funnel_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_funnel RECORD;
  v_order_id UUID;
  v_table_name TEXT;
  v_order_status TEXT;
  v_order_amount_cents INTEGER;
  v_order_created_at TIMESTAMPTZ;
  v_order_plan TEXT;
  v_quiz_id UUID;
  v_quiz_about_who TEXT;
BEGIN
  -- Determinar em qual tabela está o funil
  SELECT 'pending', * INTO v_table_name, v_funnel FROM email_funnel_pending WHERE id = p_funnel_id;
  
  IF NOT FOUND THEN
    SELECT 'completed', * INTO v_table_name, v_funnel FROM email_funnel_completed WHERE id = p_funnel_id;
  END IF;
  
  IF NOT FOUND THEN
    SELECT 'exited', * INTO v_table_name, v_funnel FROM email_funnel_exited WHERE id = p_funnel_id;
  END IF;
  
  IF NOT FOUND THEN
    RAISE WARNING 'Email funnel % not found', p_funnel_id;
    RETURN FALSE;
  END IF;
  
  v_order_id := v_funnel.order_id;
  
  -- Buscar dados atualizados do order
  SELECT 
    o.status, o.amount_cents, o.created_at, o.plan, o.quiz_id
  INTO 
    v_order_status, v_order_amount_cents, v_order_created_at, v_order_plan, v_quiz_id
  FROM orders o
  WHERE o.id = v_order_id;
  
  IF NOT FOUND THEN
    RAISE WARNING 'Order % not found', v_order_id;
    RETURN FALSE;
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
    UPDATE email_funnel_pending
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
    UPDATE email_funnel_completed
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
    UPDATE email_funnel_exited
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

-- Comentários
COMMENT ON FUNCTION move_email_funnel_to_pending(UUID) IS 'Move funil de email para tabela pending';
COMMENT ON FUNCTION move_email_funnel_to_completed(UUID) IS 'Move funil de email para tabela completed';
COMMENT ON FUNCTION move_email_funnel_to_exited(UUID, TEXT) IS 'Move funil de email para tabela exited com motivo';
COMMENT ON FUNCTION update_email_funnel_order_data(UUID) IS 'Atualiza dados do order no funil de email';

