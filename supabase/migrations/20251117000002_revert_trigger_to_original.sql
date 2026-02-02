-- ==========================================
-- Reverter Trigger para Versão Original
-- ==========================================
-- Restaura o trigger para funcionar como antes (sem validação de transaction_id)
-- Prioridade é o ID do pedido, não a validação de transaction_id
-- ==========================================

-- Função do trigger que marca automaticamente pedidos Cakto como pagos
-- ✅ REVERTIDO: Volta a funcionar como antes, sem validação de transaction_id
CREATE OR REPLACE FUNCTION trigger_auto_mark_cakto_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verificar se é um pedido Cakto
  IF (NEW.provider = 'cakto' OR NEW.payment_provider = 'cakto') THEN
    -- Verificar se cakto_payment_status mudou para approved/paid/pago
    -- E se status ainda está pending
    IF NEW.status = 'pending' 
       AND NEW.cakto_payment_status IN ('approved', 'paid', 'pago', 'aprovada')
       AND (OLD.cakto_payment_status IS NULL 
            OR OLD.cakto_payment_status NOT IN ('approved', 'paid', 'pago', 'aprovada')) THEN
      
      -- Marcar como pago automaticamente
      NEW.status := 'paid';
      NEW.paid_at := COALESCE(NEW.paid_at, NEW.created_at);
      NEW.updated_at := NOW();
      
      RAISE NOTICE '✅ [Trigger Auto Mark] Pedido % marcado automaticamente como pago (cakto_payment_status: %)', 
        NEW.id, NEW.cakto_payment_status;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Atualizar trigger
DROP TRIGGER IF EXISTS trigger_auto_mark_cakto_paid ON orders;
CREATE TRIGGER trigger_auto_mark_cakto_paid
  BEFORE UPDATE ON orders
  FOR EACH ROW
  WHEN (
    (NEW.provider = 'cakto' OR NEW.payment_provider = 'cakto')
    AND NEW.status = 'pending'
    AND NEW.cakto_payment_status IN ('approved', 'paid', 'pago', 'aprovada')
    AND (OLD.cakto_payment_status IS NULL 
         OR OLD.cakto_payment_status NOT IN ('approved', 'paid', 'pago', 'aprovada'))
  )
  EXECUTE FUNCTION trigger_auto_mark_cakto_paid();

-- Comentários
COMMENT ON FUNCTION trigger_auto_mark_cakto_paid() IS 
'Função do trigger que marca automaticamente pedidos Cakto como pagos quando cakto_payment_status muda para approved/paid/pago. Dispara o trigger_complete_payment_flow para enviar emails e gerar letras.';

COMMENT ON TRIGGER trigger_auto_mark_cakto_paid ON orders IS 
'Trigger BEFORE UPDATE que marca automaticamente pedidos Cakto como pagos quando cakto_payment_status muda para approved/paid/pago.';

