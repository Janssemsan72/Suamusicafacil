-- ==========================================
-- Correção: Função mark_funnel_and_order_as_paid
-- ==========================================
-- Esta migração corrige a função para garantir que sempre atualize
-- o pedido quando chamada, mesmo que já esteja como 'paid'
-- Isso garante que paid_at seja sempre atualizado corretamente
-- ==========================================

CREATE OR REPLACE FUNCTION mark_funnel_and_order_as_paid(p_order_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_funnel RECORD;
  v_funnel_id UUID;
  v_current_status TEXT;
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
  
  -- Verificar se a atualização foi bem-sucedida
  IF NOT FOUND THEN
    RAISE WARNING 'Nenhuma linha atualizada para o pedido: %', p_order_id;
    RETURN NULL;
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

-- Comentário
COMMENT ON FUNCTION mark_funnel_and_order_as_paid(UUID) IS 
'Marca ordem como paga e move funil para completed simultaneamente. Sempre atualiza paid_at e updated_at, mesmo se pedido já estiver como paid.';

