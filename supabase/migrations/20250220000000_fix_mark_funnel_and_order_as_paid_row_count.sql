-- ==========================================
-- Correção: Usar GET DIAGNOSTICS ROW_COUNT em vez de IF NOT FOUND
-- ==========================================
-- O problema: IF NOT FOUND pode retornar TRUE mesmo quando o pedido existe
-- se o UPDATE não alterar nenhuma linha (ex: pedido já está como 'paid' 
-- com os mesmos valores). Isso gera warnings falsos.
-- 
-- Solução: Usar GET DIAGNOSTICS ROW_COUNT para verificar quantas linhas
-- foram realmente atualizadas. Se for 0, significa que o pedido não existe
-- ou não precisa ser atualizado (já está correto).
-- ==========================================

-- Corrigir função mark_funnel_and_order_as_paid
CREATE OR REPLACE FUNCTION mark_funnel_and_order_as_paid(p_order_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_funnel RECORD;
  v_funnel_id UUID;
  v_current_status TEXT;
  v_updated_count INTEGER;
BEGIN
  -- Verificar status atual do pedido
  SELECT status INTO v_current_status
  FROM orders
  WHERE id = p_order_id;
  
  -- Se pedido não existe, retornar NULL
  IF v_current_status IS NULL THEN
    RAISE WARNING 'Pedido não encontrado: %', p_order_id;
    RETURN NULL;
  END IF;
  
  -- Atualizar order para paid
  -- IMPORTANTE: Se paid_at não existir, usar created_at (data de criação da ordem)
  -- para que a venda seja contada na data correta, não na data em que foi marcada como paga
  UPDATE orders
  SET 
    status = 'paid',
    paid_at = COALESCE(paid_at, created_at),
    updated_at = NOW()
  WHERE id = p_order_id;
  
  -- ✅ CORREÇÃO: Usar GET DIAGNOSTICS ROW_COUNT em vez de IF NOT FOUND
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  -- Se nenhuma linha foi atualizada, pode ser que:
  -- 1. O pedido foi deletado entre a verificação e o UPDATE (raro, mas possível)
  -- 2. O pedido já está com os valores corretos (status='paid', paid_at já definido)
  -- Neste caso, não é um erro crítico, apenas logamos como NOTICE
  IF v_updated_count = 0 THEN
    RAISE NOTICE 'Nenhuma linha atualizada para o pedido: % (pedido pode já estar correto ou ter sido deletado)', p_order_id;
    -- Não retornamos NULL aqui, pois o pedido pode já estar correto
    -- Continuamos o fluxo para processar o funil se existir
  END IF;
  
  -- Buscar funil em pending
  SELECT id INTO v_funnel_id
  FROM whatsapp_funnel_pending
  WHERE order_id = p_order_id
  LIMIT 1;
  
  -- Se encontrou funil, mover para completed
  IF v_funnel_id IS NOT NULL THEN
    BEGIN
      PERFORM move_funnel_to_completed(v_funnel_id);
      
      -- Cancelar mensagens pendentes
      UPDATE whatsapp_messages
      SET 
        status = 'cancelled',
        updated_at = NOW()
      WHERE funnel_id = v_funnel_id
        AND status = 'pending';
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Erro ao mover funil para completed: %', SQLERRM;
    END;
  END IF;
  
  RETURN v_funnel_id;
END;
$$;

-- Corrigir função mark_email_funnel_and_order_as_paid também
CREATE OR REPLACE FUNCTION mark_email_funnel_and_order_as_paid(p_order_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_funnel RECORD;
  v_funnel_id UUID;
  v_current_status TEXT;
  v_updated_count INTEGER;
BEGIN
  -- Verificar status atual do pedido
  SELECT status INTO v_current_status
  FROM orders
  WHERE id = p_order_id;
  
  -- Se pedido não existe, retornar NULL
  IF v_current_status IS NULL THEN
    RAISE WARNING 'Pedido não encontrado: %', p_order_id;
    RETURN NULL;
  END IF;
  
  -- Atualizar order para paid
  -- IMPORTANTE: Se paid_at não existir, usar created_at (data de criação da ordem)
  -- para que a venda seja contada na data correta, não na data em que foi marcada como paga
  UPDATE orders
  SET 
    status = 'paid',
    paid_at = COALESCE(paid_at, created_at),
    updated_at = NOW()
  WHERE id = p_order_id;
  
  -- ✅ CORREÇÃO: Usar GET DIAGNOSTICS ROW_COUNT em vez de IF NOT FOUND
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  -- Se nenhuma linha foi atualizada, pode ser que:
  -- 1. O pedido foi deletado entre a verificação e o UPDATE (raro, mas possível)
  -- 2. O pedido já está com os valores corretos (status='paid', paid_at já definido)
  -- Neste caso, não é um erro crítico, apenas logamos como NOTICE
  IF v_updated_count = 0 THEN
    RAISE NOTICE 'Nenhuma linha atualizada para o pedido: % (pedido pode já estar correto ou ter sido deletado)', p_order_id;
    -- Não retornamos NULL aqui, pois o pedido pode já estar correto
    -- Continuamos o fluxo para processar o funil se existir
  END IF;
  
  -- Buscar funil de email em pending
  SELECT id INTO v_funnel_id
  FROM email_funnel_pending
  WHERE order_id = p_order_id
  LIMIT 1;
  
  -- Se encontrou funil, mover para completed
  IF v_funnel_id IS NOT NULL THEN
    BEGIN
      PERFORM move_email_funnel_to_completed(v_funnel_id);
      
      -- Cancelar emails pendentes
      UPDATE email_messages
      SET 
        status = 'cancelled',
        updated_at = NOW()
      WHERE funnel_id = v_funnel_id
        AND status = 'pending';
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Erro ao mover funil de email para completed: %', SQLERRM;
    END;
  END IF;
  
  RETURN v_funnel_id;
END;
$$;

-- Comentários atualizados
COMMENT ON FUNCTION mark_funnel_and_order_as_paid(UUID) IS 
'Marca ordem como paga e move funil para completed simultaneamente. Usa GET DIAGNOSTICS ROW_COUNT para verificar atualizações, evitando warnings falsos quando o pedido já está correto.';

COMMENT ON FUNCTION mark_email_funnel_and_order_as_paid(UUID) IS 
'Marca ordem como paga e move funil de email para completed simultaneamente. Usa GET DIAGNOSTICS ROW_COUNT para verificar atualizações, evitando warnings falsos quando o pedido já está correto.';









