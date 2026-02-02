-- ==========================================
-- Trigger para enviar email automaticamente quando pedido é marcado como pago
-- ==========================================
-- Esta migração cria um trigger que chama uma Edge Function via pg_net
-- quando um pedido é marcado como 'paid'
-- ==========================================

-- Função que será executada pelo trigger
CREATE OR REPLACE FUNCTION trigger_send_payment_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id UUID;
  v_customer_email TEXT;
  v_has_email_log BOOLEAN;
BEGIN
  -- Só processar se status mudou para 'paid'
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    v_order_id := NEW.id;
    v_customer_email := NEW.customer_email;
    
    -- Verificar se já existe email_log para este pedido
    SELECT EXISTS (
      SELECT 1 
      FROM email_logs 
      WHERE order_id = v_order_id 
        AND email_type = 'order_paid' 
        AND status = 'sent'
    ) INTO v_has_email_log;
    
    -- Se não tem email enviado, chamar Edge Function via pg_net
    IF NOT v_has_email_log THEN
      -- Usar pg_net para chamar a Edge Function
      -- Nota: pg_net precisa estar habilitado no Supabase
      PERFORM net.http_post(
        url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-email-with-variables',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key', true)
        ),
        body := jsonb_build_object(
          'template_type', 'order_paid',
          'order_id', v_order_id::text,
          'to_email', v_customer_email
        )
      );
      
      RAISE NOTICE 'Email de pagamento disparado para pedido % (email: %)', v_order_id, v_customer_email;
    ELSE
      RAISE NOTICE 'Email de pagamento já foi enviado para pedido %', v_order_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_auto_send_payment_email ON orders;
CREATE TRIGGER trigger_auto_send_payment_email
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  WHEN (NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid'))
  EXECUTE FUNCTION trigger_send_payment_email();

-- Comentários
COMMENT ON FUNCTION trigger_send_payment_email() IS 
'Função do trigger que envia email de confirmação de pagamento automaticamente quando pedido é marcado como paid. Usa pg_net para chamar Edge Function.';

COMMENT ON TRIGGER trigger_auto_send_payment_email ON orders IS 
'Trigger que dispara envio automático de email quando status muda para paid.';

