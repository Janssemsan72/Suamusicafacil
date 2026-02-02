-- ==========================================
-- Funções SQL para criar funis WhatsApp diretamente no banco
-- ==========================================

-- Adicionar coluna exit_reason se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'whatsapp_funnel' 
    AND column_name = 'exit_reason'
  ) THEN
    ALTER TABLE whatsapp_funnel ADD COLUMN exit_reason TEXT;
    RAISE NOTICE 'Coluna exit_reason adicionada à tabela whatsapp_funnel';
  END IF;
END $$;

-- Função para criar funis para pedidos pendentes
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
  v_five_minutes_ago TIMESTAMPTZ;
  v_link_exists BOOLEAN;
BEGIN
  -- Calcular timestamp de 5 minutos atrás
  v_five_minutes_ago := NOW() - INTERVAL '5 minutes';
  
  -- Buscar pedidos pendentes com WhatsApp que não têm funil em nenhuma das 3 tabelas
  FOR v_order IN
    SELECT 
      o.id,
      o.customer_whatsapp,
      o.customer_email,
      o.quiz_id,
      o.created_at,
      o.status,
      o.amount_cents,
      o.plan
    FROM orders o
    WHERE o.status = 'pending'
      AND o.customer_whatsapp IS NOT NULL
      AND TRIM(o.customer_whatsapp) != ''
      AND o.quiz_id IS NOT NULL
      AND o.created_at < v_five_minutes_ago
      AND NOT EXISTS (
        SELECT 1 FROM whatsapp_funnel_pending WHERE order_id = o.id
        UNION ALL
        SELECT 1 FROM whatsapp_funnel_completed WHERE order_id = o.id
        UNION ALL
        SELECT 1 FROM whatsapp_funnel_exited WHERE order_id = o.id
      )
    ORDER BY o.created_at ASC
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

-- Função para verificar pedidos pagos e atualizar funis
CREATE OR REPLACE FUNCTION check_paid_orders_in_funnel()
RETURNS TABLE(
  funnels_updated INTEGER,
  orders_paid UUID[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_funnel RECORD;
  v_updated_count INTEGER := 0;
  v_paid_orders UUID[] := ARRAY[]::UUID[];
BEGIN
  -- Buscar funis em pending cujos pedidos foram pagos
  FOR v_funnel IN
    SELECT 
      wf.id,
      wf.order_id,
      o.status as order_status
    FROM whatsapp_funnel_pending wf
    INNER JOIN orders o ON o.id = wf.order_id
    WHERE o.status = 'paid'
  LOOP
    BEGIN
      -- Mover funil para completed usando a função
      PERFORM move_funnel_to_completed(v_funnel.id);
      
      -- Cancelar mensagens pendentes
      UPDATE whatsapp_messages
      SET 
        status = 'cancelled',
        updated_at = NOW()
      WHERE funnel_id = v_funnel.id
        AND status = 'pending';
      
      v_updated_count := v_updated_count + 1;
      v_paid_orders := array_append(v_paid_orders, v_funnel.order_id);
      
      RAISE NOTICE '✅ Funil % movido para completed: pedido % foi pago', v_funnel.id, v_funnel.order_id;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '❌ Erro ao mover funil %: %', v_funnel.id, SQLERRM;
    END;
  END LOOP;
  
  RETURN QUERY SELECT v_updated_count::INTEGER, v_paid_orders;
END;
$$;

-- Garantir que admins podem executar as funções
GRANT EXECUTE ON FUNCTION create_whatsapp_funnels_for_pending_orders() TO authenticated;
GRANT EXECUTE ON FUNCTION check_paid_orders_in_funnel() TO authenticated;

-- Comentários
COMMENT ON FUNCTION create_whatsapp_funnels_for_pending_orders() IS 
'Cria funis WhatsApp para pedidos pendentes com mais de 5 minutos que têm WhatsApp válido';

COMMENT ON FUNCTION check_paid_orders_in_funnel() IS 
'Verifica se pedidos em funis ativos foram pagos e atualiza status do funil para exited';

