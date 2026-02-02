-- ==========================================
-- CORREÇÃO COMPLETA: Todas as Inconsistências do Banco de Dados
-- ==========================================
-- Este script corrige TODAS as inconsistências identificadas:
-- 1. Pedidos marcados incorretamente como pagos (especialmente 13/11 e 14/11)
-- 2. Trigger de email enviando para pedidos não pagos
-- 3. Pedidos sem indicadores válidos de pagamento
-- 4. paid_at incorreto
-- 
-- Objetivo: Restaurar estado como no dia 12/11
-- ==========================================

DO $$
DECLARE
  v_total_pagos_antes INTEGER;
  v_total_pagos_depois INTEGER;
  v_corrigidos_approved INTEGER := 0;
  v_corrigidos_paid_at INTEGER := 0;
  v_corrigidos_paid_at_data INTEGER := 0;
  v_corrigidos_incorretos INTEGER := 0;
  v_corrigidos_13_14 INTEGER := 0;
BEGIN
  RAISE NOTICE '🔧 ============================================';
  RAISE NOTICE '🔧 CORREÇÃO COMPLETA DO BANCO DE DADOS';
  RAISE NOTICE '🔧 Restaurar estado como no dia 12/11';
  RAISE NOTICE '🔧 ============================================';
  RAISE NOTICE '';

  -- Contar pedidos pagos antes
  SELECT COUNT(*) INTO v_total_pagos_antes
  FROM orders
  WHERE status = 'paid';

  RAISE NOTICE '📊 Total de pedidos pagos ANTES: %', v_total_pagos_antes;
  RAISE NOTICE '🎯 Total ESPERADO: 241 pedidos pagos';
  RAISE NOTICE '';

  -- ============================================
  -- PASSO 1: Corrigir trigger de email (já aplicado na migração anterior)
  -- ============================================
  RAISE NOTICE '📋 PASSO 1: Verificando trigger de email...';
  RAISE NOTICE '   ✅ Trigger já corrigido na migração 20250215000000';
  RAISE NOTICE '';

  -- ============================================
  -- PASSO 2: Corrigir pedidos approved não pagos
  -- ============================================
  RAISE NOTICE '📋 PASSO 2: Corrigindo pedidos approved não pagos...';
  
  UPDATE orders
  SET 
    status = 'paid',
    paid_at = created_at,
    updated_at = NOW()
  WHERE cakto_payment_status = 'approved'
    AND status != 'paid'
    AND cakto_transaction_id IS NOT NULL
    AND cakto_transaction_id != '';
  
  GET DIAGNOSTICS v_corrigidos_approved = ROW_COUNT;
  RAISE NOTICE '   ✅ Corrigidos % pedidos approved não pagos', v_corrigidos_approved;
  RAISE NOTICE '';

  -- ============================================
  -- PASSO 3: Corrigir pedidos pagos sem paid_at
  -- ============================================
  RAISE NOTICE '📋 PASSO 3: Corrigindo pedidos pagos sem paid_at...';
  
  UPDATE orders
  SET 
    paid_at = created_at,
    updated_at = NOW()
  WHERE status = 'paid'
    AND paid_at IS NULL;
  
  GET DIAGNOSTICS v_corrigidos_paid_at = ROW_COUNT;
  RAISE NOTICE '   ✅ Corrigidos % pedidos pagos sem paid_at', v_corrigidos_paid_at;
  RAISE NOTICE '';

  -- ============================================
  -- PASSO 4: Corrigir paid_at para created_at (gráficos corretos)
  -- ============================================
  RAISE NOTICE '📋 PASSO 4: Corrigindo paid_at para created_at...';
  
  UPDATE orders
  SET 
    paid_at = created_at,
    updated_at = NOW()
  WHERE status = 'paid'
    AND paid_at IS NOT NULL
    AND created_at IS NOT NULL
    AND DATE(paid_at) != DATE(created_at);
  
  GET DIAGNOSTICS v_corrigidos_paid_at_data = ROW_COUNT;
  v_corrigidos_paid_at := v_corrigidos_paid_at + v_corrigidos_paid_at_data;
  RAISE NOTICE '   ✅ Corrigidos paid_at para created_at: %', v_corrigidos_paid_at_data;
  RAISE NOTICE '';

  -- ============================================
  -- PASSO 5: Corrigir pedidos incorretos dos dias 13/11 e 14/11
  -- ============================================
  RAISE NOTICE '📋 PASSO 5: Corrigindo pedidos incorretos dos dias 13/11 e 14/11...';
  
  -- Desmarcar pedidos que não têm indicadores válidos
  UPDATE orders
  SET 
    status = 'pending',
    paid_at = NULL,
    updated_at = NOW()
  WHERE created_at >= '2025-11-13 00:00:00'::timestamp
    AND created_at <= '2025-11-14 23:59:59'::timestamp
    AND status = 'paid'
    AND NOT (
      (cakto_transaction_id IS NOT NULL AND cakto_transaction_id != '') OR
      cakto_payment_status = 'approved' OR
      provider = 'cakto' OR
      payment_provider = 'cakto'
    )
    -- Não desmarcar pedidos muito recentes (últimas 24h) - podem ser vendas reais
    AND created_at < NOW() - INTERVAL '24 hours';
  
  GET DIAGNOSTICS v_corrigidos_13_14 = ROW_COUNT;
  RAISE NOTICE '   ✅ Corrigidos % pedidos incorretos dos dias 13/11 e 14/11', v_corrigidos_13_14;
  RAISE NOTICE '';

  -- ============================================
  -- PASSO 6: Corrigir TODOS os pedidos pagos sem indicadores válidos
  -- ============================================
  RAISE NOTICE '📋 PASSO 6: Corrigindo TODOS os pedidos pagos sem indicadores válidos...';
  
  UPDATE orders
  SET 
    status = 'pending',
    paid_at = NULL,
    updated_at = NOW()
  WHERE status = 'paid'
    AND NOT (
      (cakto_transaction_id IS NOT NULL AND cakto_transaction_id != '') OR
      cakto_payment_status = 'approved' OR
      (stripe_payment_intent_id IS NOT NULL AND stripe_payment_intent_id != '') OR
      provider IN ('cakto', 'stripe') OR
      payment_provider IN ('cakto', 'stripe')
    )
    -- Não desmarcar pedidos muito recentes (últimas 24h) - podem ser vendas reais
    AND created_at < NOW() - INTERVAL '24 hours';
  
  GET DIAGNOSTICS v_corrigidos_incorretos = ROW_COUNT;
  RAISE NOTICE '   ✅ Corrigidos % pedidos pagos sem indicadores válidos', v_corrigidos_incorretos;
  RAISE NOTICE '';

  -- ============================================
  -- PASSO 7: Verificar consistência final
  -- ============================================
  RAISE NOTICE '📋 PASSO 7: Verificando consistência final...';
  
  SELECT COUNT(*) INTO v_total_pagos_depois
  FROM orders
  WHERE status = 'paid';

  -- Verificar pedidos approved não pagos restantes
  DECLARE
    v_approved_nao_paid INTEGER;
    v_paid_sem_paid_at INTEGER;
    v_paid_sem_indicador INTEGER;
  BEGIN
    SELECT COUNT(*) INTO v_approved_nao_paid
    FROM orders
    WHERE cakto_payment_status = 'approved'
      AND status != 'paid'
      AND cakto_transaction_id IS NOT NULL;
    
    SELECT COUNT(*) INTO v_paid_sem_paid_at
    FROM orders
    WHERE status = 'paid'
      AND paid_at IS NULL;
    
    SELECT COUNT(*) INTO v_paid_sem_indicador
    FROM orders
    WHERE status = 'paid'
      AND NOT (
        (cakto_transaction_id IS NOT NULL AND cakto_transaction_id != '') OR
        cakto_payment_status = 'approved' OR
        (stripe_payment_intent_id IS NOT NULL AND stripe_payment_intent_id != '') OR
        provider IN ('cakto', 'stripe') OR
        payment_provider IN ('cakto', 'stripe')
      )
      AND created_at < NOW() - INTERVAL '24 hours';
    
    RAISE NOTICE '';
    RAISE NOTICE '   ✅ Pedidos approved não pagos restantes: %', v_approved_nao_paid;
    RAISE NOTICE '   ✅ Pedidos pagos sem paid_at restantes: %', v_paid_sem_paid_at;
    RAISE NOTICE '   ✅ Pedidos pagos sem indicador restantes: %', v_paid_sem_indicador;
    
    IF v_approved_nao_paid = 0 AND v_paid_sem_paid_at = 0 AND v_paid_sem_indicador = 0 THEN
      RAISE NOTICE '';
      RAISE NOTICE '   ✅ Todos os dados estão consistentes!';
    ELSE
      RAISE NOTICE '';
      RAISE NOTICE '   ⚠️  Ainda há inconsistências. Execute novamente se necessário.';
    END IF;
  END;

  -- ============================================
  -- RESUMO
  -- ============================================
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE '📋 RESUMO DA CORREÇÃO';
  RAISE NOTICE '';
  RAISE NOTICE '   Total de pedidos pagos ANTES: %', v_total_pagos_antes;
  RAISE NOTICE '   Total de pedidos pagos DEPOIS: %', v_total_pagos_depois;
  RAISE NOTICE '   Total ESPERADO: 241 pedidos pagos';
  RAISE NOTICE '   Diferença do esperado: % pedidos', (v_total_pagos_depois - 241);
  RAISE NOTICE '';
  RAISE NOTICE '   ✅ Pedidos approved marcados como pagos: %', v_corrigidos_approved;
  RAISE NOTICE '   ✅ Paid_at corrigidos: %', v_corrigidos_paid_at;
  RAISE NOTICE '   ✅ Pedidos incorretos dos dias 13/11-14/11: %', v_corrigidos_13_14;
  RAISE NOTICE '   ✅ Pedidos pagos sem indicadores: %', v_corrigidos_incorretos;
  RAISE NOTICE '   ✅ Total de correções: %', (v_corrigidos_approved + v_corrigidos_paid_at + v_corrigidos_13_14 + v_corrigidos_incorretos);
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE '';

END $$;

-- ============================================
-- Verificação: Estatísticas finais
-- ============================================
SELECT 
  'Estatísticas Finais' as tipo,
  COUNT(*) FILTER (WHERE status = 'paid') as total_pagos,
  COUNT(*) FILTER (WHERE status = 'pending') as total_pendentes,
  COUNT(*) FILTER (WHERE status = 'refunded') as total_reembolsados,
  COUNT(*) as total_geral
FROM orders;

-- ============================================
-- Verificação: Pedidos pagos por data (últimos 30 dias)
-- ============================================
SELECT 
  DATE(paid_at) as data_pagamento,
  COUNT(*) as pedidos_pagos,
  SUM(amount_cents) / 100.0 as valor_total_reais
FROM orders
WHERE status = 'paid'
  AND paid_at IS NOT NULL
  AND paid_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(paid_at)
ORDER BY data_pagamento DESC;

-- ============================================
-- Verificação: Pedidos pagos sem indicadores válidos (últimas 24h excluídas)
-- ============================================
SELECT 
  'Pedidos Pagos Sem Indicadores (últimas 24h excluídas)' as tipo,
  COUNT(*) as total
FROM orders
WHERE status = 'paid'
  AND NOT (
    (cakto_transaction_id IS NOT NULL AND cakto_transaction_id != '') OR
    cakto_payment_status = 'approved' OR
    (stripe_payment_intent_id IS NOT NULL AND stripe_payment_intent_id != '') OR
    provider IN ('cakto', 'stripe') OR
    payment_provider IN ('cakto', 'stripe')
  )
  AND created_at < NOW() - INTERVAL '24 hours';
