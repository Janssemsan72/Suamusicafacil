-- ==========================================
-- Solução SIMPLES: Modificar mark_funnel_and_order_as_paid para garantir envio de email
-- ==========================================
-- Como pg_net pode não estar disponível, vamos garantir que o email seja enviado
-- através de uma verificação na função RPC e log para monitoramento
-- ==========================================

-- Função auxiliar para verificar se email precisa ser enviado
CREATE OR REPLACE FUNCTION check_and_log_payment_email_needed(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_has_email_log BOOLEAN;
  v_order_email TEXT;
BEGIN
  -- Buscar email do pedido
  SELECT customer_email INTO v_order_email
  FROM orders
  WHERE id = p_order_id;
  
  IF v_order_email IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Verificar se já existe email_log
  SELECT EXISTS (
    SELECT 1 
    FROM email_logs 
    WHERE order_id = p_order_id 
      AND email_type = 'order_paid' 
      AND status = 'sent'
  ) INTO v_has_email_log;
  
  -- Se não tem email, criar log de pendência
  IF NOT v_has_email_log THEN
    -- Inserir log indicando que email precisa ser enviado
    INSERT INTO email_logs (
      order_id,
      email_type,
      status,
      recipient_email,
      error_message,
      created_at
    ) VALUES (
      p_order_id,
      'order_paid',
      'pending', -- Status pending indica que precisa ser enviado
      v_order_email,
      'Email pendente - aguardando envio automático',
      NOW()
    ) ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Email de pagamento pendente para pedido % (email: %)', p_order_id, v_order_email;
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$;

-- Modificar mark_funnel_and_order_as_paid para verificar email
CREATE OR REPLACE FUNCTION mark_funnel_and_order_as_paid(p_order_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_funnel RECORD;
  v_funnel_id UUID;
  v_current_status TEXT;
  v_email_needed BOOLEAN;
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
  
  -- ✅ NOVO: Verificar se email precisa ser enviado
  -- Se status mudou de não-paid para paid, verificar email
  IF v_current_status != 'paid' THEN
    v_email_needed := check_and_log_payment_email_needed(p_order_id);
    
    IF v_email_needed THEN
      RAISE NOTICE '⚠️ ATENÇÃO: Email de pagamento precisa ser enviado para pedido %. Use a Edge Function send-email-with-variables.', p_order_id;
    END IF;
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

-- Comentário atualizado
COMMENT ON FUNCTION mark_funnel_and_order_as_paid(UUID) IS 
'Marca ordem como paga e move funil para completed simultaneamente. Verifica se email de pagamento precisa ser enviado e cria log se necessário.';

COMMENT ON FUNCTION check_and_log_payment_email_needed(UUID) IS 
'Verifica se email de pagamento precisa ser enviado para um pedido e cria log se necessário.';

