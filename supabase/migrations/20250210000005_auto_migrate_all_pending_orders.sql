-- ==========================================
-- Função para migrar automaticamente TODOS os pedidos pending
-- ==========================================
-- Esta função cria funis para todos os pedidos pending que atendem aos critérios
-- Pode ser chamada manualmente ou via cron job

CREATE OR REPLACE FUNCTION auto_migrate_all_pending_orders()
RETURNS TABLE(
  funnels_created INTEGER,
  orders_processed UUID[],
  failed_orders JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result RECORD;
  v_funnels_created INTEGER := 0;
  v_orders_processed UUID[] := ARRAY[]::UUID[];
  v_failed_orders JSONB := '[]'::JSONB;
  v_funnel_id UUID;
  v_error_message TEXT;
  v_total_eligible INTEGER;
  v_with_funnel INTEGER;
  v_without_funnel INTEGER;
BEGIN
  RAISE NOTICE '🔄 [AutoMigrate] Iniciando migração automática de TODOS os pedidos pending...';
  
  -- Contar total de pedidos pending elegíveis
  SELECT COUNT(*) INTO v_total_eligible
  FROM orders o
  WHERE o.status = 'pending'
    AND o.customer_whatsapp IS NOT NULL
    AND TRIM(o.customer_whatsapp) != ''
    AND o.quiz_id IS NOT NULL;
  
  SELECT COUNT(*) INTO v_with_funnel
  FROM orders o
  WHERE o.status = 'pending'
    AND o.customer_whatsapp IS NOT NULL
    AND TRIM(o.customer_whatsapp) != ''
    AND o.quiz_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM whatsapp_funnel_pending wfp WHERE wfp.order_id = o.id
      UNION ALL
      SELECT 1 FROM whatsapp_funnel_completed wfc WHERE wfc.order_id = o.id
      UNION ALL
      SELECT 1 FROM whatsapp_funnel_exited wfe WHERE wfe.order_id = o.id
    );
  
  v_without_funnel := v_total_eligible - v_with_funnel;
  
  RAISE NOTICE '📊 [AutoMigrate] Estatísticas: Total elegível: %, Com funil: %, Sem funil: %', 
    v_total_eligible, v_with_funnel, v_without_funnel;
  
  -- Se não há pedidos sem funil, retornar vazio
  IF v_without_funnel = 0 THEN
    RAISE NOTICE '✅ [AutoMigrate] Todos os pedidos pending elegíveis já têm funil.';
    RETURN QUERY SELECT 0::INTEGER, ARRAY[]::UUID[], '[]'::JSONB;
    RETURN;
  END IF;
  
  -- Buscar TODOS os pedidos pending que não têm funil
  FOR v_result IN
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
      -- Que não têm funil em nenhuma das 3 tabelas
      AND NOT EXISTS (
        SELECT 1 FROM whatsapp_funnel_pending wfp WHERE wfp.order_id = o.id
        UNION
        SELECT 1 FROM whatsapp_funnel_completed wfc WHERE wfc.order_id = o.id
        UNION
        SELECT 1 FROM whatsapp_funnel_exited wfe WHERE wfe.order_id = o.id
      )
    ORDER BY COALESCE(o.pending_at, o.created_at) ASC
    LIMIT 500 -- Processar até 500 por vez (aumentado de 100 para processar mais pedidos)
  LOOP
    BEGIN
      RAISE NOTICE '🔄 [AutoMigrate] Tentando criar funil para pedido % (WhatsApp: %, Quiz: %)', 
        v_result.id, 
        v_result.customer_whatsapp,
        v_result.quiz_id;
      
      -- Criar funil usando a função auxiliar
      -- Tentar até 2 vezes em caso de erro temporário
      v_funnel_id := NULL;
      FOR i IN 1..2 LOOP
        BEGIN
          SELECT create_funnel_for_order(v_result.id) INTO v_funnel_id;
          EXIT WHEN v_funnel_id IS NOT NULL;
          
          IF i < 2 THEN
            RAISE NOTICE '🔄 [AutoMigrate] Tentativa % falhou para pedido %, tentando novamente...', i, v_result.id;
            PERFORM pg_sleep(0.1); -- Pequeno delay antes de tentar novamente
          END IF;
        EXCEPTION WHEN OTHERS THEN
          IF i = 2 THEN
            RAISE; -- Re-lançar exceção na última tentativa
          END IF;
        END;
      END LOOP;
      
      IF v_funnel_id IS NULL THEN
        -- Funil não foi criado (provavelmente não atende critérios)
        RAISE WARNING '⚠️ [AutoMigrate] Funil não foi criado para pedido % (retornou NULL após 2 tentativas)', v_result.id;
        v_failed_orders := v_failed_orders || jsonb_build_object(
          'order_id', v_result.id,
          'reason', 'create_funnel_for_order retornou NULL após 2 tentativas',
          'whatsapp', v_result.customer_whatsapp,
          'quiz_id', v_result.quiz_id
        );
      ELSE
        v_funnels_created := v_funnels_created + 1;
        v_orders_processed := array_append(v_orders_processed, v_result.id);
        RAISE NOTICE '✅ [AutoMigrate] Funil criado para pedido % (ID do funil: %)', v_result.id, v_funnel_id;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      v_error_message := SQLERRM;
      RAISE WARNING '❌ [AutoMigrate] Erro ao criar funil para pedido %: %', v_result.id, v_error_message;
      v_failed_orders := v_failed_orders || jsonb_build_object(
        'order_id', v_result.id,
        'reason', v_error_message,
        'whatsapp', v_result.customer_whatsapp,
        'quiz_id', v_result.quiz_id,
        'error_code', SQLSTATE
      );
    END;
  END LOOP;
  
  RAISE NOTICE '✅ [AutoMigrate] Migração concluída: % funis criados para % pedidos, % falharam', 
    v_funnels_created, 
    array_length(v_orders_processed, 1),
    jsonb_array_length(v_failed_orders);
  
  RETURN QUERY SELECT v_funnels_created::INTEGER, v_orders_processed, v_failed_orders;
END;
$$;

-- Permissões
GRANT EXECUTE ON FUNCTION auto_migrate_all_pending_orders() TO authenticated, service_role;

-- Comentário
COMMENT ON FUNCTION auto_migrate_all_pending_orders() IS 
'Migra automaticamente TODOS os pedidos pending que não têm funil. Processa até 500 pedidos por vez com retry automático. Pode ser chamada via cron job ou manualmente.';

