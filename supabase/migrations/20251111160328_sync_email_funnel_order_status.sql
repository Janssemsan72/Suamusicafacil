-- ==========================================
-- Atualizar Trigger para Sincronizar order_status em Funis de Email
-- ==========================================
-- Estende o trigger existente para também atualizar order_status nas tabelas de funil de email

-- Atualizar função para incluir funis de email
CREATE OR REPLACE FUNCTION sync_funnel_order_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Atualizar order_status em whatsapp_funnel_pending
  UPDATE whatsapp_funnel_pending
  SET 
    order_status = NEW.status::TEXT,
    updated_at = NOW()
  WHERE order_id = NEW.id;
  
  -- Atualizar order_status em whatsapp_funnel_completed
  UPDATE whatsapp_funnel_completed
  SET 
    order_status = NEW.status::TEXT,
    updated_at = NOW()
  WHERE order_id = NEW.id;
  
  -- Atualizar order_status em whatsapp_funnel_exited
  UPDATE whatsapp_funnel_exited
  SET 
    order_status = NEW.status::TEXT,
    updated_at = NOW()
  WHERE order_id = NEW.id;
  
  -- Atualizar order_status em email_funnel_pending
  UPDATE email_funnel_pending
  SET 
    order_status = NEW.status::TEXT,
    updated_at = NOW()
  WHERE order_id = NEW.id;
  
  -- Atualizar order_status em email_funnel_completed
  UPDATE email_funnel_completed
  SET 
    order_status = NEW.status::TEXT,
    updated_at = NOW()
  WHERE order_id = NEW.id;
  
  -- Atualizar order_status em email_funnel_exited
  UPDATE email_funnel_exited
  SET 
    order_status = NEW.status::TEXT,
    updated_at = NOW()
  WHERE order_id = NEW.id;
  
  RETURN NEW;
END;
$$;

-- Atualizar order_status existente para garantir sincronização inicial (funis de email)
UPDATE email_funnel_pending efp
SET order_status = o.status::TEXT
FROM orders o
WHERE efp.order_id = o.id
  AND (efp.order_status IS NULL OR efp.order_status != o.status::TEXT);

UPDATE email_funnel_completed efc
SET order_status = o.status::TEXT
FROM orders o
WHERE efc.order_id = o.id
  AND (efc.order_status IS NULL OR efc.order_status != o.status::TEXT);

UPDATE email_funnel_exited efe
SET order_status = o.status::TEXT
FROM orders o
WHERE efe.order_id = o.id
  AND (efe.order_status IS NULL OR efe.order_status != o.status::TEXT);

-- Comentário atualizado
COMMENT ON FUNCTION sync_funnel_order_status() IS 
'Atualiza automaticamente o campo order_status nas tabelas de funil (WhatsApp e Email) quando o status de um pedido é alterado.';

