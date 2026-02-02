-- ==========================================
-- Corrigir create_funnel_for_order com Logs Detalhados
-- ==========================================
-- Esta migration adiciona logs detalhados e verifica se o quiz existe antes de criar o funil

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
  BEGIN
    PERFORM ensure_checkout_links_for_order(p_order_id);
    RAISE NOTICE '✅ [create_funnel_for_order] Checkout links criados para pedido %', p_order_id;
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
  
  RAISE NOTICE '✅ [create_funnel_for_order] Dados do quiz carregados: about_who=%', COALESCE(v_quiz.about_who, 'NULL');
  
  -- IMPORTANTE: Criar funil SEMPRE em whatsapp_funnel_pending
  -- Esta função sempre cria na tabela pending, nunca em completed ou exited
  -- Os funis só são movidos para outras tabelas através das funções move_funnel_to_*
  BEGIN
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
    
    RAISE NOTICE '✅ [create_funnel_for_order] Funil criado com sucesso: ID=%', v_funnel_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '❌ [create_funnel_for_order] Erro ao inserir funil na tabela: % (SQLSTATE: %)', 
      SQLERRM, SQLSTATE;
    RETURN NULL;
  END;
  
  -- Criar checkout link se não existir
  SELECT EXISTS (
    SELECT 1 FROM checkout_links 
    WHERE order_id = v_order.id 
    AND quiz_id = v_order.quiz_id
    AND expires_at > NOW()
    AND used_at IS NULL
  ) INTO v_link_exists;
  
  IF NOT v_link_exists THEN
    BEGIN
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
      RAISE NOTICE '✅ [create_funnel_for_order] Checkout link criado para pedido %', v_order.id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '⚠️ [create_funnel_for_order] Erro ao criar checkout link (não crítico): %', SQLERRM;
      -- Não retornar NULL aqui, pois o funil já foi criado
    END;
  ELSE
    RAISE NOTICE 'ℹ️ [create_funnel_for_order] Checkout link já existe para pedido %', v_order.id;
  END IF;
  
  -- Criar registro inicial de mensagem (será enviada pela Edge Function process-funnel após 7 minutos)
  BEGIN
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
    RAISE NOTICE '✅ [create_funnel_for_order] Mensagem inicial criada para funil %', v_funnel_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '⚠️ [create_funnel_for_order] Erro ao criar mensagem inicial (não crítico): %', SQLERRM;
    -- Não retornar NULL aqui, pois o funil já foi criado
  END;
  
  RAISE NOTICE '✅ [create_funnel_for_order] Funil criado automaticamente para pedido % (WhatsApp: %, Funil ID: %)', 
    v_order.id, v_order.customer_whatsapp, v_funnel_id;
  
  RETURN v_funnel_id;
  
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '❌ [create_funnel_for_order] Erro geral ao criar funil para pedido %: % (SQLSTATE: %)', 
    p_order_id, SQLERRM, SQLSTATE;
  RETURN NULL;
END;
$$;

-- Comentário
COMMENT ON FUNCTION create_funnel_for_order(UUID) IS 
'Cria funil WhatsApp automaticamente para um pedido específico. Retorna o ID do funil criado ou NULL se não foi possível criar. Versão com logs detalhados para debug.';

