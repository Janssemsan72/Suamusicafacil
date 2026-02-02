-- ==========================================
-- Correção: Atualizar paid_at para usar created_at
-- ==========================================
-- Esta migração corrige ordens que foram marcadas como pagas manualmente
-- e têm paid_at diferente de created_at. Isso garante que as vendas sejam
-- contadas na data correta (data de criação da ordem, não data de pagamento)
-- 
-- IMPORTANTE: Todas as ordens pagas devem ter paid_at = created_at para que
-- as vendas sejam contadas na data em que a ordem foi criada, não na data
-- em que foi marcada como paga manualmente.
-- 
-- PROBLEMA ESPECÍFICO: Ordens criadas em dias anteriores mas marcadas como
-- pagas hoje estão sendo contadas incorretamente no gráfico de hoje.
-- Esta correção resolve isso atualizando paid_at para created_at.
-- ==========================================

-- PASSO 1: Atualizar paid_at para created_at para todas as ordens pagas onde paid_at é diferente de created_at
-- Isso garante que as vendas sejam contadas na data correta no gráfico "Vendas nos Últimos 30 Dias"
UPDATE orders
SET 
  paid_at = created_at,
  updated_at = NOW()
WHERE 
  status = 'paid'
  AND paid_at IS NOT NULL
  AND created_at IS NOT NULL
  AND paid_at != created_at;

-- PASSO 2: Log da correção
DO $$
DECLARE
  v_updated_count INTEGER;
  v_hoje_criadas INTEGER;
  v_hoje_pagas INTEGER;
BEGIN
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE '✅ Corrigidas % ordens: paid_at atualizado para created_at', v_updated_count;
  
  -- Verificar quantas ordens foram criadas hoje
  SELECT COUNT(*) INTO v_hoje_criadas
  FROM orders
  WHERE status = 'paid' AND DATE(created_at) = CURRENT_DATE;
  
  -- Verificar quantas ordens têm paid_at de hoje
  SELECT COUNT(*) INTO v_hoje_pagas
  FROM orders
  WHERE status = 'paid' AND DATE(paid_at) = CURRENT_DATE;
  
  RAISE NOTICE '📊 Estatísticas após correção:';
  RAISE NOTICE '   Ordens criadas hoje: %', v_hoje_criadas;
  RAISE NOTICE '   Ordens com paid_at de hoje: %', v_hoje_pagas;
  
  IF v_hoje_criadas != v_hoje_pagas THEN
    RAISE WARNING '⚠️  Ainda há diferença entre ordens criadas hoje e ordens com paid_at de hoje';
  END IF;
END $$;

