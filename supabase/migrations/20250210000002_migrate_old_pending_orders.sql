-- ==========================================
-- Migração de Pedidos Antigos para o Funil
-- ==========================================
-- Migra TODOS os pedidos pending que não têm funil para o funil

-- Remover função existente se houver (para permitir mudança de tipo de retorno)
DROP FUNCTION IF EXISTS migrate_all_pending_orders_to_funnel();

-- Função para migrar todos os pedidos pending sem funil
CREATE FUNCTION migrate_all_pending_orders_to_funnel()
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
  RAISE NOTICE '🔄 Iniciando migração de TODOS os pedidos pending sem funil...';
  
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
  
  RAISE NOTICE '📊 [MigrateAll] Estatísticas: Total elegível: %, Com funil: %, Sem funil: %', 
    v_total_eligible, v_with_funnel, v_without_funnel;
  
  -- Buscar TODOS os pedidos pending que não têm funil (sem limite de data)
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
        UNION ALL
        SELECT 1 FROM whatsapp_funnel_completed wfc WHERE wfc.order_id = o.id
        UNION ALL
        SELECT 1 FROM whatsapp_funnel_exited wfe WHERE wfe.order_id = o.id
      )
    ORDER BY COALESCE(o.pending_at, o.created_at) ASC
  LOOP
    BEGIN
      RAISE NOTICE '🔄 Tentando criar funil para pedido % (WhatsApp: %, Quiz: %)', 
        v_result.id, 
        v_result.customer_whatsapp,
        v_result.quiz_id;
      
      -- Criar funil usando a função auxiliar
      SELECT create_funnel_for_order(v_result.id) INTO v_funnel_id;
      
      IF v_funnel_id IS NULL THEN
        -- Funil não foi criado (provavelmente já existe ou não atende critérios)
        RAISE WARNING '⚠️ Funil não foi criado para pedido % (retornou NULL)', v_result.id;
        v_failed_orders := v_failed_orders || jsonb_build_object(
          'order_id', v_result.id,
          'reason', 'create_funnel_for_order retornou NULL',
          'whatsapp', v_result.customer_whatsapp,
          'quiz_id', v_result.quiz_id
        );
      ELSE
        v_funnels_created := v_funnels_created + 1;
        v_orders_processed := array_append(v_orders_processed, v_result.id);
        RAISE NOTICE '✅ Funil criado para pedido % (ID do funil: %)', v_result.id, v_funnel_id;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      v_error_message := SQLERRM;
      RAISE WARNING '❌ Erro ao criar funil para pedido %: %', v_result.id, v_error_message;
      v_failed_orders := v_failed_orders || jsonb_build_object(
        'order_id', v_result.id,
        'reason', v_error_message,
        'whatsapp', v_result.customer_whatsapp,
        'quiz_id', v_result.quiz_id,
        'error_code', SQLSTATE
      );
    END;
  END LOOP;
  
  RAISE NOTICE '✅ Migração concluída: % funis criados para % pedidos, % falharam', 
    v_funnels_created, 
    array_length(v_orders_processed, 1),
    jsonb_array_length(v_failed_orders);
  
  RETURN QUERY SELECT v_funnels_created::INTEGER, v_orders_processed, v_failed_orders;
END;
$$;

-- Executar migração imediatamente
DO $$
DECLARE
  v_result RECORD;
BEGIN
  SELECT * INTO v_result FROM migrate_all_pending_orders_to_funnel();
  RAISE NOTICE '📊 Resultado da migração: % funis criados', v_result.funnels_created;
END $$;

-- Verificar resultado (TODOS os pedidos pending, sem limite de data)
SELECT 
  COUNT(*) as total_pending_orders,
  COUNT(CASE WHEN EXISTS (
    SELECT 1 FROM whatsapp_funnel_pending wfp WHERE wfp.order_id = o.id
    UNION ALL
    SELECT 1 FROM whatsapp_funnel_completed wfc WHERE wfc.order_id = o.id
    UNION ALL
    SELECT 1 FROM whatsapp_funnel_exited wfe WHERE wfe.order_id = o.id
  ) THEN 1 END) as orders_with_funnel,
  COUNT(CASE WHEN NOT EXISTS (
    SELECT 1 FROM whatsapp_funnel_pending wfp WHERE wfp.order_id = o.id
    UNION ALL
    SELECT 1 FROM whatsapp_funnel_completed wfc WHERE wfc.order_id = o.id
    UNION ALL
    SELECT 1 FROM whatsapp_funnel_exited wfe WHERE wfe.order_id = o.id
  ) THEN 1 END) as orders_without_funnel
FROM orders o
WHERE o.status = 'pending'
  AND o.customer_whatsapp IS NOT NULL
  AND TRIM(o.customer_whatsapp) != ''
  AND o.quiz_id IS NOT NULL;

-- Permissões
GRANT EXECUTE ON FUNCTION migrate_all_pending_orders_to_funnel() TO authenticated, service_role;

-- Comentário
COMMENT ON FUNCTION migrate_all_pending_orders_to_funnel() IS 
'Migra TODOS os pedidos pending que não têm funil para o funil. Pode ser chamada manualmente para processar pedidos antigos.';

