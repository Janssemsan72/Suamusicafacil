-- ==========================================
-- Correção: UNION queries nas funções de mover funil
-- Problema: Tabelas têm números diferentes de colunas (completed_at, exited_at)
-- Solução: Especificar explicitamente todas as colunas comuns
-- ==========================================

-- Função para mover funil para pending (CORRIGIDA)
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
  
  -- Armazenar valores em variáveis locais para usar na função
  v_order_id := v_funnel.order_id;
  v_quiz_id_param := v_funnel.quiz_id;
  
  -- Sincronizar dados de order e quiz (usar variáveis locais)
  -- sync_funnel_order_data retorna TABLE, então precisamos usar uma subquery
  SELECT 
    od.order_status, od.order_amount_cents, od.order_created_at,
    od.order_plan, od.quiz_id, od.quiz_about_who
  INTO 
    v_order_status, v_order_amount_cents, v_order_created_at,
    v_order_plan, v_quiz_id, v_quiz_about_who
  FROM (
    SELECT * FROM sync_funnel_order_data(v_order_id, v_quiz_id_param)
  ) AS od
  LIMIT 1;
  
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

-- Função para mover funil para completed (CORRIGIDA)
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
  
  -- Armazenar valores em variáveis locais para usar na função
  v_order_id := v_funnel.order_id;
  v_quiz_id_param := v_funnel.quiz_id;
  
  -- Sincronizar dados de order e quiz (usar variáveis locais)
  -- sync_funnel_order_data retorna TABLE, então precisamos usar uma subquery
  SELECT 
    od.order_status, od.order_amount_cents, od.order_created_at,
    od.order_plan, od.quiz_id, od.quiz_about_who
  INTO 
    v_order_status, v_order_amount_cents, v_order_created_at,
    v_order_plan, v_quiz_id, v_quiz_about_who
  FROM (
    SELECT * FROM sync_funnel_order_data(v_order_id, v_quiz_id_param)
  ) AS od
  LIMIT 1;
  
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

-- Função para mover funil para exited (CORRIGIDA)
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
  
  -- Armazenar valores em variáveis locais para usar na função
  v_order_id := v_funnel.order_id;
  v_quiz_id_param := v_funnel.quiz_id;
  
  -- Sincronizar dados de order e quiz (usar variáveis locais)
  -- sync_funnel_order_data retorna TABLE, então precisamos usar uma subquery
  SELECT 
    od.order_status, od.order_amount_cents, od.order_created_at,
    od.order_plan, od.quiz_id, od.quiz_about_who
  INTO 
    v_order_status, v_order_amount_cents, v_order_created_at,
    v_order_plan, v_quiz_id, v_quiz_about_who
  FROM (
    SELECT * FROM sync_funnel_order_data(v_order_id, v_quiz_id_param)
  ) AS od
  LIMIT 1;
  
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

-- Garantir permissões
GRANT EXECUTE ON FUNCTION move_funnel_to_pending(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION move_funnel_to_completed(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION move_funnel_to_exited(UUID, TEXT) TO authenticated, service_role;

COMMENT ON FUNCTION move_funnel_to_pending(UUID) IS 'Move um funil para a tabela pending. Corrigido para especificar explicitamente todas as colunas no UNION.';
COMMENT ON FUNCTION move_funnel_to_completed(UUID) IS 'Move um funil para a tabela completed. Corrigido para especificar explicitamente todas as colunas no UNION.';
COMMENT ON FUNCTION move_funnel_to_exited(UUID, TEXT) IS 'Move um funil para a tabela exited. Corrigido para especificar explicitamente todas as colunas no UNION.';

