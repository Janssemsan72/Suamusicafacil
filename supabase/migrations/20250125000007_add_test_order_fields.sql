-- ==========================================
-- Adicionar campos para identificar pedidos de teste
-- ==========================================

-- Adicionar campo is_test_order na tabela orders
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS is_test_order BOOLEAN DEFAULT false;

-- Adicionar campo customer_name na tabela orders
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS customer_name TEXT;

-- Atualizar pedidos existentes que são claramente de teste
UPDATE orders 
SET is_test_order = true 
WHERE customer_email LIKE '%test%' 
   OR customer_email LIKE '%@teste%'
   OR customer_email LIKE '%@musiclovely.com'
   OR customer_email LIKE '%teste%';

-- Criar índice para melhor performance nas consultas de pedidos de teste
CREATE INDEX IF NOT EXISTS idx_orders_is_test_order ON orders(is_test_order);

-- Criar índice para consultas por email do cliente
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);

-- Comentários para documentação
COMMENT ON COLUMN orders.is_test_order IS 'Indica se o pedido é de teste (true) ou venda real (false)';
COMMENT ON COLUMN orders.customer_name IS 'Nome do cliente para pedidos convertidos de teste';
