-- ==========================================
-- Trigger para mover funis de email automaticamente quando pedido é pago
-- ==========================================

-- Função do trigger que será executada após UPDATE quando status muda para 'paid'
CREATE OR REPLACE FUNCTION trigger_auto_move_email_funnel_to_completed()
RETURNS TRIGGER AS $$
DECLARE
  v_funnel_id UUID;
BEGIN
  -- Apenas processar se status mudou para 'paid'
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    -- Buscar funil de email em pending
    SELECT id INTO v_funnel_id
    FROM email_funnel_pending
    WHERE order_id = NEW.id
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
        
        RAISE NOTICE '✅ Funil de email % movido para completed: pedido % foi pago', v_funnel_id, NEW.id;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE WARNING '❌ Erro ao mover funil de email % para completed: %', v_funnel_id, SQLERRM;
      END;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger após UPDATE quando status muda para 'paid'
DROP TRIGGER IF EXISTS trigger_auto_move_email_funnel_to_completed ON orders;
CREATE TRIGGER trigger_auto_move_email_funnel_to_completed
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  WHEN (NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid'))
  EXECUTE FUNCTION trigger_auto_move_email_funnel_to_completed();

-- Comentários
COMMENT ON FUNCTION trigger_auto_move_email_funnel_to_completed() IS 
'Função do trigger que move funil de email para completed automaticamente quando pedido é marcado como paid.';

COMMENT ON TRIGGER trigger_auto_move_email_funnel_to_completed ON orders IS 
'Trigger que move funil de email para completed quando status do pedido muda para paid.';

