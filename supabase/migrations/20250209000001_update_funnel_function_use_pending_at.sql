-- ==========================================
-- Atualizar função create_whatsapp_funnels_for_pending_orders
-- para usar pending_at ao invés de created_at
-- ==========================================

CREATE OR REPLACE FUNCTION create_whatsapp_funnels_for_pending_orders()
RETURNS TABLE(
  funnels_created INTEGER,
  orders_processed UUID[]
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
  v_quiz RECORD;
  v_funnel_id UUID;
  v_funnels_count INTEGER := 0;
  v_processed_orders UUID[] := ARRAY[]::UUID[];
  v_seven_minutes_ago TIMESTAMPTZ;
  v_link_exists BOOLEAN;
BEGIN
  -- Calcular timestamp de 7 minutos atrás (consistente com o intervalo do funil)
  v_seven_minutes_ago := NOW() - INTERVAL '7 minutes';
  
  -- Buscar pedidos pendentes com WhatsApp que não têm funil em nenhuma das 3 tabelas
  -- Usa pending_at (quando entrou em pending) ao invés de created_at
  -- Se pending_at não existir, usa created_at como fallback
  FOR v_order IN
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
    FROM orders o
    WHERE o.status = 'pending'
      AND o.customer_whatsapp IS NOT NULL
      AND TRIM(o.customer_whatsapp) != ''
      AND o.quiz_id IS NOT NULL
      -- Usa pending_at se disponível, senão usa created_at como fallback
      AND COALESCE(o.pending_at, o.created_at) < v_seven_minutes_ago
      AND NOT EXISTS (
        SELECT 1 FROM whatsapp_funnel_pending WHERE order_id = o.id
        UNION ALL
        SELECT 1 FROM whatsapp_funnel_completed WHERE order_id = o.id
        UNION ALL
        SELECT 1 FROM whatsapp_funnel_exited WHERE order_id = o.id
      )
    ORDER BY COALESCE(o.pending_at, o.created_at) ASC
  LOOP
    BEGIN
      -- Buscar dados do quiz para campos duplicados
      SELECT q.about_who INTO v_quiz
      FROM quizzes q
      WHERE q.id = v_order.quiz_id;
      
      -- Criar funil em pending com campos duplicados preenchidos
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
        NOW(), -- Primeira mensagem será processada imediatamente
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
      
      -- Criar registro inicial de mensagem (será enviada pela Edge Function process-funnel ou send-checkout-link)
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
      
      v_funnels_count := v_funnels_count + 1;
      v_processed_orders := array_append(v_processed_orders, v_order.id);
      
      RAISE NOTICE '✅ Funil criado para pedido % (WhatsApp: %)', v_order.id, v_order.customer_whatsapp;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '❌ Erro ao criar funil para pedido %: %', v_order.id, SQLERRM;
    END;
  END LOOP;
  
  RETURN QUERY SELECT v_funnels_count::INTEGER, v_processed_orders;
END;
$$;

-- Atualizar comentário
COMMENT ON FUNCTION create_whatsapp_funnels_for_pending_orders() IS 
'Cria funis WhatsApp para pedidos pendentes com mais de 5 minutos desde que entraram em pending (usa pending_at ao invés de created_at)';

