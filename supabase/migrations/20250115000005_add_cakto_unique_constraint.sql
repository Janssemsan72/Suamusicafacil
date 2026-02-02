-- ==========================================
-- Adicionar constraint de unicidade para cakto_transaction_id
-- ==========================================
-- 
-- Objetivo: Prevenir duplicações de pedidos Cakto no banco de dados
-- A constraint garante que cada cakto_transaction_id apareça apenas uma vez
-- (onde não for NULL)

-- Primeiro, verificar se há duplicações existentes
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT cakto_transaction_id, COUNT(*) as cnt
    FROM orders
    WHERE cakto_transaction_id IS NOT NULL
    GROUP BY cakto_transaction_id
    HAVING COUNT(*) > 1
  ) duplicates;
  
  IF duplicate_count > 0 THEN
    RAISE NOTICE '⚠️  ATENÇÃO: Existem % grupos de cakto_transaction_id duplicados. A constraint não será criada até que sejam resolvidos.', duplicate_count;
    RAISE EXCEPTION 'Duplicações encontradas. Resolva antes de aplicar a constraint.';
  END IF;
END $$;

-- Criar índice único (que funciona como constraint) apenas onde cakto_transaction_id não é NULL
-- Usamos um índice parcial (partial index) para permitir múltiplos NULLs
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_cakto_transaction_unique 
ON orders (cakto_transaction_id) 
WHERE cakto_transaction_id IS NOT NULL;

-- Adicionar comentário
COMMENT ON INDEX idx_orders_cakto_transaction_unique IS 
'Garante que cada cakto_transaction_id apareça apenas uma vez no banco, prevenindo duplicações de webhook';

