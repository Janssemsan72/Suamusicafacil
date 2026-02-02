-- ==========================================
-- CORRIGIR POLÍTICAS RLS DA TABELA ORDERS
-- ==========================================

-- Remover políticas problemáticas
DROP POLICY IF EXISTS "Prevent paid order modification" ON orders;
DROP POLICY IF EXISTS "Users can create own orders" ON orders;
DROP POLICY IF EXISTS "Anyone can create orders" ON orders;
DROP POLICY IF EXISTS "Anyone can update orders" ON orders;
DROP POLICY IF EXISTS "Anyone can read orders" ON orders;

-- Criar políticas simples e funcionais
CREATE POLICY "Anyone can create orders" 
ON orders 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update orders" 
ON orders 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can read orders" 
ON orders 
FOR SELECT 
USING (true);
