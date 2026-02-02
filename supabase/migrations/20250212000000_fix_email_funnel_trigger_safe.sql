-- ==========================================
-- Correção: Tornar trigger de email_funnel seguro (verificar se tabela existe)
-- ==========================================
-- Este trigger pode falhar se a tabela email_funnel_pending não existir
-- Vamos torná-lo seguro verificando se a tabela existe antes de acessá-la
-- ==========================================

-- Recriar função do trigger de forma segura
CREATE OR REPLACE FUNCTION trigger_auto_move_email_funnel_to_completed()
RETURNS TRIGGER AS $$
DECLARE
  v_funnel_id UUID;
  v_table_exists BOOLEAN;
BEGIN
  -- Apenas processar se status mudou para 'paid'
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    -- Verificar se a tabela email_funnel_pending existe
    SELECT EXISTS (
      SELECT 1 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'email_funnel_pending'
    ) INTO v_table_exists;
    
    -- Se a tabela existe, tentar mover funil
    IF v_table_exists THEN
      BEGIN
        -- Buscar funil de email em pending
        SELECT id INTO v_funnel_id
        FROM email_funnel_pending
        WHERE order_id = NEW.id
        LIMIT 1;
        
        -- Se encontrou funil, mover para completed
        IF v_funnel_id IS NOT NULL THEN
          BEGIN
            -- Verificar se a função move_email_funnel_to_completed existe
            PERFORM move_email_funnel_to_completed(v_funnel_id);
            
            -- Cancelar emails pendentes (se a tabela existir)
            IF EXISTS (
              SELECT 1 
              FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name = 'email_messages'
            ) THEN
              UPDATE email_messages
              SET 
                status = 'cancelled',
                updated_at = NOW()
              WHERE funnel_id = v_funnel_id
                AND status = 'pending';
            END IF;
            
            RAISE NOTICE '✅ Funil de email % movido para completed: pedido % foi pago', v_funnel_id, NEW.id;
          EXCEPTION
            WHEN OTHERS THEN
              RAISE WARNING '❌ Erro ao mover funil de email % para completed: %', v_funnel_id, SQLERRM;
          END;
        END IF;
      EXCEPTION
        WHEN OTHERS THEN
          -- Ignorar erro se tabela não existir ou houver outro problema
          RAISE WARNING '⚠️ Erro ao processar funil de email para pedido %: %', NEW.id, SQLERRM;
      END;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Comentários
COMMENT ON FUNCTION trigger_auto_move_email_funnel_to_completed() IS 
'Função do trigger que move funil de email para completed automaticamente quando pedido é marcado como paid. Verifica se tabelas existem antes de acessá-las.';

















