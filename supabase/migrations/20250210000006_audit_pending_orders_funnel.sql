-- ==========================================
-- Função de Auditoria Completa: Pedidos Pending e Funis
-- ==========================================
-- Esta função faz uma auditoria completa para identificar por que pedidos pending não aparecem na coluna "Pendente"

CREATE OR REPLACE FUNCTION audit_pending_orders_funnel()
RETURNS TABLE(
  section TEXT,
  metric_name TEXT,
  metric_value TEXT,
  details JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_pending_orders INTEGER;
  v_pending_with_whatsapp INTEGER;
  v_pending_with_whatsapp_and_quiz INTEGER;
  v_pending_with_funnel INTEGER;
  v_pending_without_funnel INTEGER;
  v_funnels_in_pending_table INTEGER;
  v_funnels_in_completed_table INTEGER;
  v_funnels_in_exited_table INTEGER;
  v_total_funnels INTEGER;
  v_paused_funnels INTEGER;
  v_active_funnels INTEGER;
BEGIN
  -- ==========================================
  -- SEÇÃO 1: Estatísticas de Pedidos Pending
  -- ==========================================
  
  -- Total de pedidos pending
  SELECT COUNT(*) INTO v_total_pending_orders
  FROM orders
  WHERE status = 'pending';
  
  RETURN QUERY SELECT 
    '1. Pedidos Pending'::TEXT,
    'Total de pedidos pending'::TEXT,
    v_total_pending_orders::TEXT,
    jsonb_build_object('count', v_total_pending_orders);
  
  -- Pedidos pending com WhatsApp
  SELECT COUNT(*) INTO v_pending_with_whatsapp
  FROM orders
  WHERE status = 'pending'
    AND customer_whatsapp IS NOT NULL
    AND TRIM(customer_whatsapp) != '';
  
  RETURN QUERY SELECT 
    '1. Pedidos Pending'::TEXT,
    'Com WhatsApp válido'::TEXT,
    v_pending_with_whatsapp::TEXT,
    jsonb_build_object('count', v_pending_with_whatsapp);
  
  -- Pedidos pending com WhatsApp E quiz_id
  SELECT COUNT(*) INTO v_pending_with_whatsapp_and_quiz
  FROM orders
  WHERE status = 'pending'
    AND customer_whatsapp IS NOT NULL
    AND TRIM(customer_whatsapp) != ''
    AND quiz_id IS NOT NULL;
  
  RETURN QUERY SELECT 
    '1. Pedidos Pending'::TEXT,
    'Com WhatsApp E quiz_id'::TEXT,
    v_pending_with_whatsapp_and_quiz::TEXT,
    jsonb_build_object('count', v_pending_with_whatsapp_and_quiz);
  
  -- ==========================================
  -- SEÇÃO 2: Estatísticas de Funis
  -- ==========================================
  
  -- Funis na tabela pending
  SELECT COUNT(*) INTO v_funnels_in_pending_table
  FROM whatsapp_funnel_pending;
  
  RETURN QUERY SELECT 
    '2. Funis'::TEXT,
    'Na tabela whatsapp_funnel_pending'::TEXT,
    v_funnels_in_pending_table::TEXT,
    jsonb_build_object('count', v_funnels_in_pending_table);
  
  -- Funis na tabela completed
  SELECT COUNT(*) INTO v_funnels_in_completed_table
  FROM whatsapp_funnel_completed;
  
  RETURN QUERY SELECT 
    '2. Funis'::TEXT,
    'Na tabela whatsapp_funnel_completed'::TEXT,
    v_funnels_in_completed_table::TEXT,
    jsonb_build_object('count', v_funnels_in_completed_table);
  
  -- Funis na tabela exited
  SELECT COUNT(*) INTO v_funnels_in_exited_table
  FROM whatsapp_funnel_exited;
  
  RETURN QUERY SELECT 
    '2. Funis'::TEXT,
    'Na tabela whatsapp_funnel_exited'::TEXT,
    v_funnels_in_exited_table::TEXT,
    jsonb_build_object('count', v_funnels_in_exited_table);
  
  -- Total de funis
  v_total_funnels := v_funnels_in_pending_table + v_funnels_in_completed_table + v_funnels_in_exited_table;
  
  RETURN QUERY SELECT 
    '2. Funis'::TEXT,
    'Total de funis'::TEXT,
    v_total_funnels::TEXT,
    jsonb_build_object('count', v_total_funnels);
  
  -- Funis pausados (verificar se campo existe)
  BEGIN
    SELECT COUNT(*) INTO v_paused_funnels
    FROM whatsapp_funnel_pending
    WHERE is_paused = true;
    
    RETURN QUERY SELECT 
      '2. Funis'::TEXT,
      'Pausados em pending'::TEXT,
      v_paused_funnels::TEXT,
      jsonb_build_object('count', v_paused_funnels);
    
    -- Funis ativos
    SELECT COUNT(*) INTO v_active_funnels
    FROM whatsapp_funnel_pending
    WHERE is_paused = false;
    
    RETURN QUERY SELECT 
      '2. Funis'::TEXT,
      'Ativos em pending'::TEXT,
      v_active_funnels::TEXT,
      jsonb_build_object('count', v_active_funnels);
  EXCEPTION WHEN OTHERS THEN
    -- Campo is_paused não existe ainda, pular esta seção
    RETURN QUERY SELECT 
      '2. Funis'::TEXT,
      'Pausados em pending'::TEXT,
      'N/A (campo is_paused não existe)'::TEXT,
      jsonb_build_object('error', 'Campo is_paused não encontrado');
    
    RETURN QUERY SELECT 
      '2. Funis'::TEXT,
      'Ativos em pending'::TEXT,
      'N/A (campo is_paused não existe)'::TEXT,
      jsonb_build_object('error', 'Campo is_paused não encontrado');
  END;
  
  -- ==========================================
  -- SEÇÃO 3: Pedidos Pending COM Funil
  -- ==========================================
  -- IMPORTANTE: Usar EXATAMENTE os mesmos critérios de v_pending_with_whatsapp_and_quiz
  -- para garantir consistência na contagem
  
  SELECT COUNT(DISTINCT o.id) INTO v_pending_with_funnel
  FROM orders o
  WHERE o.status = 'pending'
    AND o.customer_whatsapp IS NOT NULL
    AND TRIM(o.customer_whatsapp) != ''
    AND o.quiz_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM whatsapp_funnel_pending wfp WHERE wfp.order_id = o.id
      UNION
      SELECT 1 FROM whatsapp_funnel_completed wfc WHERE wfc.order_id = o.id
      UNION
      SELECT 1 FROM whatsapp_funnel_exited wfe WHERE wfe.order_id = o.id
    );
  
  RETURN QUERY SELECT 
    '3. Análise'::TEXT,
    'Pedidos pending COM funil'::TEXT,
    v_pending_with_funnel::TEXT,
    jsonb_build_object('count', v_pending_with_funnel);
  
  -- ==========================================
  -- SEÇÃO 4: Pedidos Pending SEM Funil
  -- ==========================================
  -- IMPORTANTE: Calcular diretamente ao invés de subtrair para garantir precisão
  
  SELECT COUNT(DISTINCT o.id) INTO v_pending_without_funnel
  FROM orders o
  WHERE o.status = 'pending'
    AND o.customer_whatsapp IS NOT NULL
    AND TRIM(o.customer_whatsapp) != ''
    AND o.quiz_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM whatsapp_funnel_pending wfp WHERE wfp.order_id = o.id
      UNION
      SELECT 1 FROM whatsapp_funnel_completed wfc WHERE wfc.order_id = o.id
      UNION
      SELECT 1 FROM whatsapp_funnel_exited wfe WHERE wfe.order_id = o.id
    );
  
  RETURN QUERY SELECT 
    '3. Análise'::TEXT,
    'Pedidos pending SEM funil'::TEXT,
    v_pending_without_funnel::TEXT,
    jsonb_build_object('count', v_pending_without_funnel);
  
  -- ==========================================
  -- SEÇÃO 5: Lista de Pedidos Pending SEM Funil (detalhado)
  -- ==========================================
  
  RETURN QUERY
  SELECT 
    '4. Pedidos Sem Funil'::TEXT,
    'order_id'::TEXT,
    o.id::TEXT,
    jsonb_build_object(
      'order_id', o.id,
      'customer_whatsapp', o.customer_whatsapp,
      'customer_email', o.customer_email,
      'quiz_id', o.quiz_id,
      'created_at', o.created_at,
      'pending_at', o.pending_at,
      'status', o.status,
      'amount_cents', o.amount_cents,
      'tempo_desde_pending_minutos', EXTRACT(EPOCH FROM (NOW() - COALESCE(o.pending_at, o.created_at))) / 60
    )
  FROM orders o
  WHERE o.status = 'pending'
    AND o.customer_whatsapp IS NOT NULL
    AND TRIM(o.customer_whatsapp) != ''
    AND o.quiz_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM whatsapp_funnel_pending wfp WHERE wfp.order_id = o.id
      UNION
      SELECT 1 FROM whatsapp_funnel_completed wfc WHERE wfc.order_id = o.id
      UNION
      SELECT 1 FROM whatsapp_funnel_exited wfe WHERE wfe.order_id = o.id
    )
  ORDER BY COALESCE(o.pending_at, o.created_at) ASC
  LIMIT 50; -- Limitar a 50 para não sobrecarregar
  
  -- ==========================================
  -- SEÇÃO 6: Funis Órfãos (sem pedido correspondente)
  -- ==========================================
  
  RETURN QUERY
  SELECT 
    '5. Funis Órfãos'::TEXT,
    'funnel_id'::TEXT,
    wfp.id::TEXT,
    jsonb_build_object(
      'funnel_id', wfp.id,
      'order_id', wfp.order_id,
      'customer_whatsapp', wfp.customer_whatsapp,
      'order_status_duplicado', wfp.order_status,
      'is_paused', CASE 
        WHEN EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' 
            AND table_name = 'whatsapp_funnel_pending' 
            AND column_name = 'is_paused'
        ) THEN COALESCE(wfp.is_paused, false)
        ELSE NULL
      END
    )
  FROM whatsapp_funnel_pending wfp
  WHERE NOT EXISTS (
    SELECT 1 FROM orders o WHERE o.id = wfp.order_id
  )
  LIMIT 20;
  
  -- ==========================================
  -- SEÇÃO 7: Pedidos com Funis em Múltiplas Tabelas (inconsistência)
  -- ==========================================
  
  RETURN QUERY
  SELECT 
    '6. Inconsistências'::TEXT,
    'order_id'::TEXT,
    o.id::TEXT,
    jsonb_build_object(
      'order_id', o.id,
      'em_pending', EXISTS(SELECT 1 FROM whatsapp_funnel_pending wfp WHERE wfp.order_id = o.id),
      'em_completed', EXISTS(SELECT 1 FROM whatsapp_funnel_completed wfc WHERE wfc.order_id = o.id),
      'em_exited', EXISTS(SELECT 1 FROM whatsapp_funnel_exited wfe WHERE wfe.order_id = o.id)
    )
  FROM orders o
  WHERE (
    (EXISTS(SELECT 1 FROM whatsapp_funnel_pending wfp WHERE wfp.order_id = o.id)::INTEGER +
     EXISTS(SELECT 1 FROM whatsapp_funnel_completed wfc WHERE wfc.order_id = o.id)::INTEGER +
     EXISTS(SELECT 1 FROM whatsapp_funnel_exited wfe WHERE wfe.order_id = o.id)::INTEGER) > 1
  )
  LIMIT 20;
  
  -- ==========================================
  -- SEÇÃO 8: Verificação de Triggers
  -- ==========================================
  
  RETURN QUERY
  SELECT 
    '7. Triggers'::TEXT,
    'trigger_name'::TEXT,
    tgname::TEXT,
    jsonb_build_object(
      'trigger_name', tgname,
      'table_name', tgrelid::regclass::TEXT,
      'enabled', tgenabled = 'O'
    )
  FROM pg_trigger
  WHERE tgname LIKE '%funnel%'
    AND NOT tgisinternal;
  
END;
$$;

-- Permissões
GRANT EXECUTE ON FUNCTION audit_pending_orders_funnel() TO authenticated, service_role;

-- Comentário
COMMENT ON FUNCTION audit_pending_orders_funnel() IS 
'Auditoria completa de pedidos pending e funis. Retorna estatísticas detalhadas, listas de pedidos sem funil, funis órfãos, inconsistências e status de triggers.';

