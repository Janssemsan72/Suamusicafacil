-- ==========================================
-- CORRIGIR POLÍTICAS RLS DA TABELA ORDERS - VERSÃO FINAL
-- ==========================================

-- Desabilitar RLS temporariamente para limpeza
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;

-- Remover TODAS as políticas existentes
DROP POLICY IF EXISTS "Prevent paid order modification" ON orders;
DROP POLICY IF EXISTS "Users can create own orders" ON orders;
DROP POLICY IF EXISTS "Allow order creation" ON orders;
DROP POLICY IF EXISTS "Anyone can create orders" ON orders;
DROP POLICY IF EXISTS "Anyone can update orders" ON orders;
DROP POLICY IF EXISTS "Anyone can read orders" ON orders;
DROP POLICY IF EXISTS "Users can view their own orders" ON orders;

-- Reabilitar RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Criar políticas simples e permissivas
CREATE POLICY "Allow all operations on orders" 
ON orders 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Comentário explicativo
COMMENT ON POLICY "Allow all operations on orders" ON orders IS 
'Política permissiva para permitir simulação de pagamentos e operações de teste';
