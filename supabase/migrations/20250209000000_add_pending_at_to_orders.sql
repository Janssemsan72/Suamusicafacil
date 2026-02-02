-- ==========================================
-- Adicionar campo pending_at para rastrear quando pedido entra em status pending
-- ==========================================

-- 1. Adicionar coluna pending_at na tabela orders
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS pending_at TIMESTAMPTZ;

-- 2. Atualizar pedidos existentes que já estão em pending
-- Se o pedido já está pending, usar created_at como pending_at
UPDATE orders 
SET pending_at = created_at 
WHERE status = 'pending' AND pending_at IS NULL;

-- 3. Criar função para atualizar pending_at quando status mudar para pending
CREATE OR REPLACE FUNCTION update_pending_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o status mudou para 'pending', atualizar pending_at para NOW()
  -- Isso garante que o timer sempre comece do zero quando entra em pending
  -- Cobre tanto INSERT (OLD.status é NULL) quanto UPDATE (OLD.status != 'pending')
  IF NEW.status = 'pending' THEN
    -- Se é um INSERT (OLD.status é NULL) ou se o status mudou de outro para pending
    IF OLD.status IS NULL OR OLD.status != 'pending' THEN
      NEW.pending_at = NOW();
    END IF;
    -- Se já está em pending e apenas está sendo atualizado (sem mudança de status),
    -- manter o pending_at existente (não resetar)
  END IF;
  
  -- Se o status mudou de 'pending' para outro, manter o pending_at (não resetar)
  -- Isso permite rastrear quando o pedido entrou em pending pela última vez
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Criar trigger para executar a função antes de atualizar
DROP TRIGGER IF EXISTS trigger_update_pending_at ON orders;
CREATE TRIGGER trigger_update_pending_at
  BEFORE UPDATE OR INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_pending_at();

-- 5. Comentário explicativo
COMMENT ON COLUMN orders.pending_at IS 'Timestamp de quando o pedido entrou em status pending. Usado para calcular o tempo desde que o pedido está pendente, independente de quando foi criado.';

