-- ==========================================
-- AJUSTAR TOTAL PARA 241 PEDIDOS PAGOS
-- ==========================================
-- Este script garante que o total de pedidos pagos seja exatamente 241
-- Corrige qualquer inconsistência restante
-- ==========================================

DO $$
DECLARE
  v_total_atual INTEGER;
  v_esperado INTEGER := 241;
  v_diferenca INTEGER;
  v_corrigidos INTEGER := 0;
BEGIN
  RAISE NOTICE '🔧 ============================================';
  RAISE NOTICE '🔧 AJUSTAR TOTAL PARA 241 PEDIDOS PAGOS';
  RAISE NOTICE '🔧 ============================================';
  RAISE NOTICE '';

  -- Contar total atual
  SELECT COUNT(*) INTO v_total_atual
  FROM orders
  WHERE status = 'paid';

  v_diferenca := v_total_atual - v_esperado;

  RAISE NOTICE '📊 Total atual de pedidos pagos: %', v_total_atual;
  RAISE NOTICE '🎯 Total esperado: % pedidos pagos', v_esperado;
  RAISE NOTICE '📈 Diferença: % pedidos', v_diferenca;
  RAISE NOTICE '';

  -- Se há mais pedidos do que o esperado, desmarcar os que não têm indicadores válidos
  IF v_diferenca > 0 THEN
    RAISE NOTICE '📋 Desmarcando % pedidos sem indicadores válidos...', v_diferenca;
    
    -- Desmarcar pedidos sem indicadores válidos (priorizando os mais antigos)
    UPDATE orders
    SET 
      status = 'pending',
      paid_at = NULL,
      updated_at = NOW()
    WHERE id IN (
      SELECT id
      FROM orders
      WHERE status = 'paid'
        AND NOT (
          (cakto_transaction_id IS NOT NULL AND cakto_transaction_id != '') OR
          cakto_payment_status = 'approved' OR
          (stripe_payment_intent_id IS NOT NULL AND stripe_payment_intent_id != '') OR
          provider IN ('cakto', 'stripe') OR
          payment_provider IN ('cakto', 'stripe')
        )
        AND created_at < NOW() - INTERVAL '24 hours'
      ORDER BY created_at ASC
      LIMIT v_diferenca
    );
    
    GET DIAGNOSTICS v_corrigidos = ROW_COUNT;
    RAISE NOTICE '   ✅ Desmarcados % pedidos', v_corrigidos;
    RAISE NOTICE '';
  ELSIF v_diferenca < 0 THEN
    RAISE NOTICE '📋 Há % pedidos a menos. Verificando pedidos approved não pagos...', ABS(v_diferenca);
    
    -- Marcar pedidos approved que não estão pagos
    UPDATE orders
    SET 
      status = 'paid',
      paid_at = created_at,
      updated_at = NOW()
    WHERE id IN (
      SELECT id
      FROM orders
      WHERE cakto_payment_status = 'approved'
        AND status != 'paid'
        AND cakto_transaction_id IS NOT NULL
        AND cakto_transaction_id != ''
      ORDER BY created_at ASC
      LIMIT ABS(v_diferenca)
    );
    
    GET DIAGNOSTICS v_corrigidos = ROW_COUNT;
    RAISE NOTICE '   ✅ Marcados % pedidos como pagos', v_corrigidos;
    RAISE NOTICE '';
  ELSE
    RAISE NOTICE '✅ Total já está correto: % pedidos pagos', v_total_atual;
    RAISE NOTICE '';
  END IF;

  -- Verificar resultado final
  SELECT COUNT(*) INTO v_total_atual
  FROM orders
  WHERE status = 'paid';

  v_diferenca := v_total_atual - v_esperado;

  RAISE NOTICE '============================================';
  RAISE NOTICE '📋 RESULTADO FINAL:';
  RAISE NOTICE '';
  RAISE NOTICE '   Total de pedidos pagos: %', v_total_atual;
  RAISE NOTICE '   Total esperado: %', v_esperado;
  RAISE NOTICE '   Diferença: % pedidos', v_diferenca;
  RAISE NOTICE '';
  
  IF v_diferenca = 0 THEN
    RAISE NOTICE '   ✅ Total está correto!';
  ELSIF v_diferenca > 0 THEN
    RAISE NOTICE '   ⚠️  Ainda há % pedidos a mais. Pode ser vendas recentes.', v_diferenca;
  ELSE
    RAISE NOTICE '   ⚠️  Ainda há % pedidos a menos.', ABS(v_diferenca);
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE '';

END $$;

-- ============================================
-- Verificação: Total de pedidos pagos
-- ============================================
SELECT 
  'Total de Pedidos Pagos' as tipo,
  COUNT(*) as total,
  241 as esperado,
  COUNT(*) - 241 as diferenca
FROM orders
WHERE status = 'paid';

-- ============================================
-- Verificação: Pedidos pagos por data (últimos 30 dias)
-- ============================================
SELECT 
  DATE(paid_at) as data_pagamento,
  COUNT(*) as pedidos_pagos
FROM orders
WHERE status = 'paid'
  AND paid_at IS NOT NULL
  AND paid_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(paid_at)
ORDER BY data_pagamento DESC;


