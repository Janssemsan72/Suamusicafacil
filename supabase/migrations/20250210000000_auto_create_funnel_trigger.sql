-- ==========================================
-- Trigger para criar funil automaticamente quando pedido é criado com status 'pending'
-- ==========================================

-- Função auxiliar para criar funil para um pedido específico
CREATE OR REPLACE FUNCTION create_funnel_for_order(p_order_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
  v_quiz RECORD;
  v_funnel_id UUID;
  v_link_exists BOOLEAN;
BEGIN
  -- Buscar dados do pedido (sem verificar status, pois quem chama já validou)
  SELECT 
    o.id,
    o.customer_whatsapp,
    o.customer_email,
    o.quiz_id,
    o.created_at,
    o.pending_at,
    o.status,
    o.amount_cents,
    o.plan
  INTO v_order
  FROM orders o
  WHERE o.id = p_order_id;
  
  -- Verificar se pedido existe
  IF NOT FOUND THEN
    RAISE NOTICE '⚠️ Pedido % não encontrado', p_order_id;
    RETURN NULL;
  END IF;
  
  -- Verificar critérios essenciais (WhatsApp válido e quiz_id)
  IF v_order.customer_whatsapp IS NULL OR TRIM(v_order.customer_whatsapp) = '' THEN
    RAISE NOTICE '⚠️ Pedido % não tem WhatsApp válido', p_order_id;
    RETURN NULL;
  END IF;
  
  IF v_order.quiz_id IS NULL THEN
    RAISE NOTICE '⚠️ Pedido % não tem quiz_id', p_order_id;
    RETURN NULL;
  END IF;
  
  -- Verificar se já existe funil (em qualquer das 3 tabelas)
  -- IMPORTANTE: Usar UNION ao invés de UNION ALL para evitar problemas com duplicatas
  IF EXISTS (
    SELECT 1 FROM whatsapp_funnel_pending WHERE order_id = p_order_id
    UNION
    SELECT 1 FROM whatsapp_funnel_completed WHERE order_id = p_order_id
    UNION
    SELECT 1 FROM whatsapp_funnel_exited WHERE order_id = p_order_id
  ) THEN
    RAISE NOTICE '⚠️ Funil já existe para pedido %', p_order_id;
    RETURN NULL;
  END IF;
  
  -- Buscar dados do quiz para campos duplicados
  SELECT q.about_who INTO v_quiz
  FROM quizzes q
  WHERE q.id = v_order.quiz_id;
  
  -- IMPORTANTE: Criar funil SEMPRE em whatsapp_funnel_pending
  -- Esta função sempre cria na tabela pending, nunca em completed ou exited
  -- Os funis só são movidos para outras tabelas através das funções move_funnel_to_*
  INSERT INTO whatsapp_funnel_pending (
    order_id,
    customer_whatsapp,
    customer_email,
    current_step,
    next_message_at,
    ab_variant,
    last_message_sent_at,
    -- Campos duplicados
    order_status,
    order_amount_cents,
    order_created_at,
    order_plan,
    quiz_id,
    quiz_about_who
  ) VALUES (
    v_order.id,
    v_order.customer_whatsapp,
    v_order.customer_email,
    1,
    NOW() + INTERVAL '7 minutes', -- Primeira mensagem após 7 minutos
    CASE WHEN RANDOM() < 0.5 THEN 'a' ELSE 'b' END, -- Teste A/B
    NULL, -- Ainda não foi enviada
    -- Campos duplicados
    v_order.status,
    v_order.amount_cents,
    v_order.created_at,
    v_order.plan,
    v_order.quiz_id,
    COALESCE(v_quiz.about_who, '')
  )
  RETURNING id INTO v_funnel_id;
  
  -- Criar checkout link se não existir
  SELECT EXISTS (
    SELECT 1 FROM checkout_links 
    WHERE order_id = v_order.id 
    AND quiz_id = v_order.quiz_id
    AND expires_at > NOW()
    AND used_at IS NULL
  ) INTO v_link_exists;
  
  IF NOT v_link_exists THEN
    -- Gerar token seguro
    INSERT INTO checkout_links (
      order_id,
      quiz_id,
      token,
      expires_at
    ) VALUES (
      v_order.id,
      v_order.quiz_id,
      encode(gen_random_bytes(32), 'hex'), -- Token seguro de 64 caracteres
      NOW() + INTERVAL '48 hours' -- Válido por 48 horas
    );
  END IF;
  
  -- Criar registro inicial de mensagem (será enviada pela Edge Function process-funnel após 7 minutos)
  INSERT INTO whatsapp_messages (
    funnel_id,
    message_type,
    status,
    created_at
  ) VALUES (
    v_funnel_id,
    'checkout_link',
    'pending',
    NOW()
  );
  
  RAISE NOTICE '✅ Funil criado automaticamente para pedido % (WhatsApp: %)', v_order.id, v_order.customer_whatsapp;
  
  RETURN v_funnel_id;
  
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '❌ Erro ao criar funil para pedido %: %', p_order_id, SQLERRM;
  RETURN NULL;
END;
$$;

-- Função do trigger que será executada após INSERT ou UPDATE
CREATE OR REPLACE FUNCTION trigger_auto_create_funnel()
RETURNS TRIGGER AS $$
BEGIN
  -- Apenas processar se status é 'pending' e tem WhatsApp válido
  IF NEW.status = 'pending' 
     AND NEW.customer_whatsapp IS NOT NULL 
     AND TRIM(NEW.customer_whatsapp) != ''
     AND NEW.quiz_id IS NOT NULL THEN
    
    -- Verificar se já existe funil (evitar duplicatas)
    -- IMPORTANTE: Usar UNION ao invés de UNION ALL para evitar problemas com duplicatas
    IF NOT EXISTS (
      SELECT 1 FROM whatsapp_funnel_pending WHERE order_id = NEW.id
      UNION
      SELECT 1 FROM whatsapp_funnel_completed WHERE order_id = NEW.id
      UNION
      SELECT 1 FROM whatsapp_funnel_exited WHERE order_id = NEW.id
    ) THEN
      -- Criar funil automaticamente
      PERFORM create_funnel_for_order(NEW.id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger após INSERT
DROP TRIGGER IF EXISTS trigger_auto_create_funnel_on_insert ON orders;
CREATE TRIGGER trigger_auto_create_funnel_on_insert
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_create_funnel();

-- Criar trigger após UPDATE (caso status mude para pending)
DROP TRIGGER IF EXISTS trigger_auto_create_funnel_on_update ON orders;
CREATE TRIGGER trigger_auto_create_funnel_on_update
  AFTER UPDATE ON orders
  FOR EACH ROW
  WHEN (NEW.status = 'pending' AND (OLD.status IS NULL OR OLD.status != 'pending'))
  EXECUTE FUNCTION trigger_auto_create_funnel();

-- Comentários
COMMENT ON FUNCTION create_funnel_for_order(UUID) IS 
'Cria funil WhatsApp automaticamente para um pedido específico. Retorna o ID do funil criado ou NULL se não foi possível criar.';

COMMENT ON FUNCTION trigger_auto_create_funnel() IS 
'Função do trigger que cria funil automaticamente quando pedido é criado ou atualizado para status pending.';

