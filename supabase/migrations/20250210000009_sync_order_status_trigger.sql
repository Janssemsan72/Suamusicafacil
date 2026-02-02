-- ==========================================
-- Trigger para Sincronizar order_status nas Tabelas de Funil
-- ==========================================
-- Este trigger atualiza automaticamente o campo order_status nas tabelas de funil
-- quando um pedido é marcado como pago ou tem seu status alterado

-- Função para atualizar order_status em todas as tabelas de funil
CREATE OR REPLACE FUNCTION sync_funnel_order_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Atualizar order_status em whatsapp_funnel_pending
  -- IMPORTANTE: Fazer cast explícito para TEXT para evitar erro de tipo
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
  
  RETURN NEW;
END;
$$;

-- Remover trigger existente se houver
DROP TRIGGER IF EXISTS trigger_sync_funnel_order_status ON orders;

-- Criar trigger após UPDATE na tabela orders
CREATE TRIGGER trigger_sync_funnel_order_status
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION sync_funnel_order_status();

-- Comentários
COMMENT ON FUNCTION sync_funnel_order_status() IS 
'Atualiza automaticamente o campo order_status nas tabelas de funil quando o status de um pedido é alterado.';

COMMENT ON TRIGGER trigger_sync_funnel_order_status ON orders IS 
'Trigger que sincroniza order_status nas tabelas de funil quando status do pedido muda.';

-- Atualizar order_status existente para garantir sincronização inicial
-- IMPORTANTE: Fazer cast explícito para TEXT para evitar erro de tipo
UPDATE whatsapp_funnel_pending wfp
SET order_status = o.status::TEXT
FROM orders o
WHERE wfp.order_id = o.id
  AND (wfp.order_status IS NULL OR wfp.order_status != o.status::TEXT);

UPDATE whatsapp_funnel_completed wfc
SET order_status = o.status::TEXT
FROM orders o
WHERE wfc.order_id = o.id
  AND (wfc.order_status IS NULL OR wfc.order_status != o.status::TEXT);

UPDATE whatsapp_funnel_exited wfe
SET order_status = o.status::TEXT
FROM orders o
WHERE wfe.order_id = o.id
  AND (wfe.order_status IS NULL OR wfe.order_status != o.status::TEXT);

