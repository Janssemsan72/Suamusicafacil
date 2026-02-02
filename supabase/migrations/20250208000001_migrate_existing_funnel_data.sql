-- ==========================================
-- Migração de Dados Existentes
-- Move dados de whatsapp_funnel para as 3 novas tabelas
-- ==========================================

DO $$
DECLARE
  v_funnel RECORD;
  v_order RECORD;
  v_quiz RECORD;
  v_messages_count INTEGER;
  v_pending_count INTEGER := 0;
  v_completed_count INTEGER := 0;
  v_exited_count INTEGER := 0;
BEGIN
  RAISE NOTICE '🔄 Iniciando migração de dados de whatsapp_funnel...';
  
  -- Iterar sobre todos os funis existentes
  FOR v_funnel IN
    SELECT * FROM whatsapp_funnel
    ORDER BY created_at ASC
  LOOP
    BEGIN
      -- Buscar dados do order
      SELECT o.status, o.amount_cents, o.created_at, o.plan, o.quiz_id
      INTO v_order
      FROM orders o
      WHERE o.id = v_funnel.order_id;
      
      -- Buscar dados do quiz se disponível
      IF v_order.quiz_id IS NOT NULL THEN
        SELECT q.about_who
        INTO v_quiz
        FROM quizzes q
        WHERE q.id = v_order.quiz_id;
      END IF;
      
      -- Contar mensagens enviadas
      SELECT COUNT(*) INTO v_messages_count
      FROM whatsapp_messages
      WHERE funnel_id = v_funnel.id
        AND status = 'sent';
      
      -- Decidir para qual tabela mover baseado em regras de negócio
      IF v_order.status = 'paid' THEN
        -- Order pago -> completed
        INSERT INTO whatsapp_funnel_completed (
          id, order_id, customer_whatsapp, customer_email,
          current_step, last_message_sent_at, next_message_at,
          ab_variant, exit_reason, completed_at, created_at, updated_at,
          order_status, order_amount_cents, order_created_at,
          order_plan, quiz_id, quiz_about_who
        ) VALUES (
          v_funnel.id, v_funnel.order_id, v_funnel.customer_whatsapp, v_funnel.customer_email,
          v_funnel.current_step, v_funnel.last_message_sent_at, NULL,
          v_funnel.ab_variant, 'paid', NOW(), v_funnel.created_at, v_funnel.updated_at,
          v_order.status, v_order.amount_cents, v_order.created_at,
          v_order.plan, v_order.quiz_id, COALESCE(v_quiz.about_who, '')
        )
        ON CONFLICT (order_id) DO NOTHING;
        
        v_completed_count := v_completed_count + 1;
        
      ELSIF v_funnel.funnel_status = 'exited' OR (v_messages_count >= 3 AND v_order.status = 'pending') THEN
        -- Exited ou 3+ mensagens -> exited
        INSERT INTO whatsapp_funnel_exited (
          id, order_id, customer_whatsapp, customer_email,
          current_step, last_message_sent_at, next_message_at,
          ab_variant, exit_reason, exited_at, created_at, updated_at,
          order_status, order_amount_cents, order_created_at,
          order_plan, quiz_id, quiz_about_who
        ) VALUES (
          v_funnel.id, v_funnel.order_id, v_funnel.customer_whatsapp, v_funnel.customer_email,
          v_funnel.current_step, v_funnel.last_message_sent_at, NULL,
          v_funnel.ab_variant, COALESCE(v_funnel.exit_reason, 'auto_exit'), NOW(), v_funnel.created_at, v_funnel.updated_at,
          v_order.status, v_order.amount_cents, v_order.created_at,
          v_order.plan, v_order.quiz_id, COALESCE(v_quiz.about_who, '')
        )
        ON CONFLICT (order_id) DO NOTHING;
        
        v_exited_count := v_exited_count + 1;
        
      ELSE
        -- Caso contrário -> pending
        INSERT INTO whatsapp_funnel_pending (
          id, order_id, customer_whatsapp, customer_email,
          current_step, last_message_sent_at, next_message_at,
          ab_variant, exit_reason, created_at, updated_at,
          order_status, order_amount_cents, order_created_at,
          order_plan, quiz_id, quiz_about_who
        ) VALUES (
          v_funnel.id, v_funnel.order_id, v_funnel.customer_whatsapp, v_funnel.customer_email,
          v_funnel.current_step, v_funnel.last_message_sent_at, v_funnel.next_message_at,
          v_funnel.ab_variant, NULL, v_funnel.created_at, v_funnel.updated_at,
          v_order.status, v_order.amount_cents, v_order.created_at,
          v_order.plan, v_order.quiz_id, COALESCE(v_quiz.about_who, '')
        )
        ON CONFLICT (order_id) DO NOTHING;
        
        v_pending_count := v_pending_count + 1;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '❌ Erro ao migrar funil %: %', v_funnel.id, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE '✅ Migração concluída:';
  RAISE NOTICE '   - Pending: %', v_pending_count;
  RAISE NOTICE '   - Completed: %', v_completed_count;
  RAISE NOTICE '   - Exited: %', v_exited_count;
  RAISE NOTICE '   - Total: %', v_pending_count + v_completed_count + v_exited_count;
END;
$$;

-- Verificar se a migração foi bem-sucedida
DO $$
DECLARE
  v_old_count INTEGER;
  v_new_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_old_count FROM whatsapp_funnel;
  SELECT (
    (SELECT COUNT(*) FROM whatsapp_funnel_pending) +
    (SELECT COUNT(*) FROM whatsapp_funnel_completed) +
    (SELECT COUNT(*) FROM whatsapp_funnel_exited)
  ) INTO v_new_count;
  
  IF v_old_count != v_new_count THEN
    RAISE WARNING '⚠️ Discrepância na migração: % funis antigos vs % funis novos', v_old_count, v_new_count;
  ELSE
    RAISE NOTICE '✅ Migração validada: todos os % funis foram migrados', v_old_count;
  END IF;
END;
$$;

