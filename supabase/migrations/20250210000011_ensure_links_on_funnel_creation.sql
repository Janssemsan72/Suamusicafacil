-- ==========================================
-- Garantir criação de links ao criar funil
-- ==========================================
-- Esta migration atualiza create_funnel_for_order para criar links automaticamente

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
  v_quiz_exists BOOLEAN;
BEGIN
  RAISE NOTICE '🔄 [create_funnel_for_order] Iniciando criação de funil para pedido %', p_order_id;
  
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
    RAISE WARNING '❌ [create_funnel_for_order] Pedido % não encontrado', p_order_id;
    RETURN NULL;
  END IF;
  
  RAISE NOTICE '✅ [create_funnel_for_order] Pedido encontrado: status=%, whatsapp=%, quiz_id=%', 
    v_order.status, v_order.customer_whatsapp, v_order.quiz_id;
  
  -- Verificar critérios essenciais (WhatsApp válido e quiz_id)
  IF v_order.customer_whatsapp IS NULL OR TRIM(v_order.customer_whatsapp) = '' THEN
    RAISE WARNING '❌ [create_funnel_for_order] Pedido % não tem WhatsApp válido (valor: %)', 
      p_order_id, v_order.customer_whatsapp;
    RETURN NULL;
  END IF;
  
  IF v_order.quiz_id IS NULL THEN
    RAISE WARNING '❌ [create_funnel_for_order] Pedido % não tem quiz_id', p_order_id;
    RETURN NULL;
  END IF;
  
  -- Verificar se quiz existe na tabela quizzes
  SELECT EXISTS(SELECT 1 FROM quizzes WHERE id = v_order.quiz_id) INTO v_quiz_exists;
  IF NOT v_quiz_exists THEN
    RAISE WARNING '❌ [create_funnel_for_order] Quiz % não encontrado na tabela quizzes para pedido %', 
      v_order.quiz_id, p_order_id;
    RETURN NULL;
  END IF;
  
  RAISE NOTICE '✅ [create_funnel_for_order] Quiz % existe na tabela', v_order.quiz_id;
  
  -- Verificar se já existe funil (em qualquer das 3 tabelas)
  -- IMPORTANTE: Usar UNION ao invés de UNION ALL para evitar problemas com duplicatas
  IF EXISTS (
    SELECT 1 FROM whatsapp_funnel_pending WHERE order_id = p_order_id
    UNION
    SELECT 1 FROM whatsapp_funnel_completed WHERE order_id = p_order_id
    UNION
    SELECT 1 FROM whatsapp_funnel_exited WHERE order_id = p_order_id
  ) THEN
    RAISE NOTICE '⚠️ [create_funnel_for_order] Funil já existe para pedido %', p_order_id;
    RETURN NULL;
  END IF;
  
  RAISE NOTICE '✅ [create_funnel_for_order] Nenhum funil existente encontrado, prosseguindo com criação...';
  
  -- Criar checkout links imediatamente para este pedido/quiz
  -- Cada quiz terá seus próprios links únicos (checkout, edição e Cakto)
  BEGIN
    PERFORM ensure_checkout_links_for_order(p_order_id);
    RAISE NOTICE '✅ [create_funnel_for_order] Checkout links criados para pedido % (quiz %)', p_order_id, v_order.quiz_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '⚠️ [create_funnel_for_order] Erro ao criar checkout links: %', SQLERRM;
    -- Continuar mesmo se falhar, pois os links podem ser criados depois
  END;
  
  -- Buscar dados do quiz para campos duplicados
  -- IMPORTANTE: Usar LEFT JOIN ou verificar se a coluna about_who existe
  BEGIN
    SELECT q.about_who INTO v_quiz
    FROM quizzes q
    WHERE q.id = v_order.quiz_id;
    
    -- Se não encontrou, criar registro vazio
    IF NOT FOUND THEN
      RAISE WARNING '❌ [create_funnel_for_order] Erro ao buscar dados do quiz % (mesmo após verificar existência)', 
        v_order.quiz_id;
      -- Criar registro vazio para continuar
      v_quiz.about_who := '';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Se a coluna about_who não existir, usar valor padrão
    RAISE NOTICE '⚠️ [create_funnel_for_order] Erro ao buscar about_who (coluna pode não existir): %', SQLERRM;
    v_quiz.about_who := '';
  END;
  
  -- Criar funil em pending
  INSERT INTO whatsapp_funnel_pending (
    order_id,
    customer_whatsapp,
    customer_email,
    current_step,
    next_message_at,
    ab_variant,
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
    0, -- Começar no passo 0 (antes da primeira mensagem)
    NULL, -- NULL = enviar imediatamente quando processar
    CASE WHEN random() < 0.5 THEN 'a' ELSE 'b' END, -- 50% A, 50% B
    -- Campos duplicados
    v_order.status,
    v_order.amount_cents,
    v_order.created_at,
    v_order.plan,
    v_order.quiz_id,
    COALESCE(v_quiz.about_who, '')
  )
  RETURNING id INTO v_funnel_id;
  
  RAISE NOTICE '✅ [create_funnel_for_order] Funil criado com sucesso: %', v_funnel_id;
  
  RETURN v_funnel_id;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '❌ [create_funnel_for_order] Erro ao criar funil: %', SQLERRM;
  RETURN NULL;
END;
$$;

-- Comentário atualizado
COMMENT ON FUNCTION create_funnel_for_order(UUID) IS 
'Cria um funil WhatsApp para um pedido. Cria automaticamente os checkout links (checkout, edição e Cakto) para o quiz associado ao pedido.';

