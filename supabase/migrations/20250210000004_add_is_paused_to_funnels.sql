-- ==========================================
-- Adicionar campo is_paused nas tabelas de funil
-- ==========================================
-- Permite pausar/retomar processamento de funis individualmente

-- Adicionar campo is_paused na tabela whatsapp_funnel_pending
ALTER TABLE whatsapp_funnel_pending 
ADD COLUMN IF NOT EXISTS is_paused BOOLEAN NOT NULL DEFAULT FALSE;

-- Adicionar campo is_paused na tabela whatsapp_funnel_completed
ALTER TABLE whatsapp_funnel_completed 
ADD COLUMN IF NOT EXISTS is_paused BOOLEAN NOT NULL DEFAULT FALSE;

-- Adicionar campo is_paused na tabela whatsapp_funnel_exited
ALTER TABLE whatsapp_funnel_exited 
ADD COLUMN IF NOT EXISTS is_paused BOOLEAN NOT NULL DEFAULT TRUE; -- Funis exited começam pausados

-- Criar índice para performance (filtrar funis não pausados)
CREATE INDEX IF NOT EXISTS idx_funnel_pending_not_paused 
ON whatsapp_funnel_pending(next_message_at) 
WHERE is_paused = FALSE AND next_message_at IS NOT NULL;

-- Atualizar view unificada para incluir is_paused
CREATE OR REPLACE VIEW whatsapp_funnel_unified AS
SELECT 
  id, order_id, customer_whatsapp, customer_email,
  'pending' as source_table,
  current_step, last_message_sent_at, next_message_at,
  ab_variant, exit_reason, created_at, updated_at,
  order_status, order_amount_cents, order_created_at,
  order_plan, quiz_id, quiz_about_who,
  is_paused
FROM whatsapp_funnel_pending
UNION ALL
SELECT 
  id, order_id, customer_whatsapp, customer_email,
  'completed' as source_table,
  current_step, last_message_sent_at, next_message_at,
  ab_variant, exit_reason, created_at, updated_at,
  order_status, order_amount_cents, order_created_at,
  order_plan, quiz_id, quiz_about_who,
  is_paused
FROM whatsapp_funnel_completed
UNION ALL
SELECT 
  id, order_id, customer_whatsapp, customer_email,
  'exited' as source_table,
  current_step, last_message_sent_at, next_message_at,
  ab_variant, exit_reason, created_at, updated_at,
  order_status, order_amount_cents, order_created_at,
  order_plan, quiz_id, quiz_about_who,
  is_paused
FROM whatsapp_funnel_exited;

-- Função para alternar is_paused de um funil
CREATE OR REPLACE FUNCTION toggle_funnel_pause(p_funnel_id UUID, p_table_name TEXT DEFAULT 'pending')
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_paused BOOLEAN;
BEGIN
  -- Determinar tabela baseado no nome ou tentar encontrar em qual tabela está
  IF p_table_name = 'pending' THEN
    SELECT is_paused INTO v_current_paused
    FROM whatsapp_funnel_pending
    WHERE id = p_funnel_id;
    
    IF FOUND THEN
      UPDATE whatsapp_funnel_pending
      SET is_paused = NOT v_current_paused,
          updated_at = NOW()
      WHERE id = p_funnel_id;
      RETURN NOT v_current_paused;
    END IF;
  ELSIF p_table_name = 'completed' THEN
    SELECT is_paused INTO v_current_paused
    FROM whatsapp_funnel_completed
    WHERE id = p_funnel_id;
    
    IF FOUND THEN
      UPDATE whatsapp_funnel_completed
      SET is_paused = NOT v_current_paused,
          updated_at = NOW()
      WHERE id = p_funnel_id;
      RETURN NOT v_current_paused;
    END IF;
  ELSIF p_table_name = 'exited' THEN
    SELECT is_paused INTO v_current_paused
    FROM whatsapp_funnel_exited
    WHERE id = p_funnel_id;
    
    IF FOUND THEN
      UPDATE whatsapp_funnel_exited
      SET is_paused = NOT v_current_paused,
          updated_at = NOW()
      WHERE id = p_funnel_id;
      RETURN NOT v_current_paused;
    END IF;
  ELSE
    -- Tentar encontrar em qual tabela está
    SELECT is_paused INTO v_current_paused
    FROM whatsapp_funnel_pending
    WHERE id = p_funnel_id;
    
    IF FOUND THEN
      UPDATE whatsapp_funnel_pending
      SET is_paused = NOT v_current_paused,
          updated_at = NOW()
      WHERE id = p_funnel_id;
      RETURN NOT v_current_paused;
    END IF;
    
    SELECT is_paused INTO v_current_paused
    FROM whatsapp_funnel_completed
    WHERE id = p_funnel_id;
    
    IF FOUND THEN
      UPDATE whatsapp_funnel_completed
      SET is_paused = NOT v_current_paused,
          updated_at = NOW()
      WHERE id = p_funnel_id;
      RETURN NOT v_current_paused;
    END IF;
    
    SELECT is_paused INTO v_current_paused
    FROM whatsapp_funnel_exited
    WHERE id = p_funnel_id;
    
    IF FOUND THEN
      UPDATE whatsapp_funnel_exited
      SET is_paused = NOT v_current_paused,
          updated_at = NOW()
      WHERE id = p_funnel_id;
      RETURN NOT v_current_paused;
    END IF;
  END IF;
  
  RETURN NULL; -- Funil não encontrado
END;
$$;

-- Permissões
GRANT EXECUTE ON FUNCTION toggle_funnel_pause(UUID, TEXT) TO authenticated, service_role;

-- Comentários
COMMENT ON COLUMN whatsapp_funnel_pending.is_paused IS 'Indica se o funil está pausado (não processa mensagens)';
COMMENT ON COLUMN whatsapp_funnel_completed.is_paused IS 'Indica se o funil está pausado (não processa mensagens)';
COMMENT ON COLUMN whatsapp_funnel_exited.is_paused IS 'Indica se o funil está pausado. Funis exited começam pausados por padrão.';
COMMENT ON FUNCTION toggle_funnel_pause(UUID, TEXT) IS 'Alterna o estado is_paused de um funil. Retorna o novo estado (TRUE = pausado, FALSE = ativo).';

