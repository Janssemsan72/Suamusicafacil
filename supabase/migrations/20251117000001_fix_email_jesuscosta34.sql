-- ==========================================
-- Correção: Email jesuscosta34@gmsil.com → jesuscosta34@gmail.com
-- ==========================================
-- Corrige o email incorreto em todas as tabelas do banco de dados
-- ==========================================

-- 1. Corrigir email na tabela orders
UPDATE orders
SET 
  customer_email = 'jesuscosta34@gmail.com',
  updated_at = NOW()
WHERE customer_email = 'jesuscosta34@gmsil.com'
   OR customer_email ILIKE '%jesuscosta34@gmsil%';

-- 2. Corrigir email na tabela quizzes
UPDATE quizzes
SET 
  customer_email = 'jesuscosta34@gmail.com',
  updated_at = NOW()
WHERE customer_email = 'jesuscosta34@gmsil.com'
   OR customer_email ILIKE '%jesuscosta34@gmsil%';

-- 3. Corrigir email na tabela email_logs (to_email)
UPDATE email_logs
SET 
  to_email = 'jesuscosta34@gmail.com',
  updated_at = NOW()
WHERE to_email = 'jesuscosta34@gmsil.com'
   OR to_email ILIKE '%jesuscosta34@gmsil%';

-- 4. Corrigir outros emails com o mesmo problema (gmsil ao invés de gmail) na tabela orders
UPDATE orders
SET 
  customer_email = REPLACE(customer_email, '@gmsil.com', '@gmail.com'),
  updated_at = NOW()
WHERE customer_email ILIKE '%@gmsil.com%'
  AND customer_email != REPLACE(customer_email, '@gmsil.com', '@gmail.com');

-- 5. Corrigir outros emails com o mesmo problema na tabela quizzes
UPDATE quizzes
SET 
  customer_email = REPLACE(customer_email, '@gmsil.com', '@gmail.com'),
  updated_at = NOW()
WHERE customer_email ILIKE '%@gmsil.com%'
  AND customer_email != REPLACE(customer_email, '@gmsil.com', '@gmail.com');

-- 6. Corrigir outros emails com o mesmo problema na tabela email_logs
UPDATE email_logs
SET 
  to_email = REPLACE(to_email, '@gmsil.com', '@gmail.com'),
  updated_at = NOW()
WHERE to_email ILIKE '%@gmsil.com%'
  AND to_email != REPLACE(to_email, '@gmsil.com', '@gmail.com');

-- Log da correção
DO $$
DECLARE
  v_orders_count INTEGER;
  v_quizzes_count INTEGER;
  v_email_logs_count INTEGER;
BEGIN
  -- Contar correções em cada tabela
  SELECT COUNT(*) INTO v_orders_count
  FROM orders
  WHERE customer_email = 'jesuscosta34@gmail.com';
  
  SELECT COUNT(*) INTO v_quizzes_count
  FROM quizzes
  WHERE customer_email = 'jesuscosta34@gmail.com';
  
  SELECT COUNT(*) INTO v_email_logs_count
  FROM email_logs
  WHERE to_email = 'jesuscosta34@gmail.com';
  
  RAISE NOTICE '✅ Email corrigido: jesuscosta34@gmsil.com → jesuscosta34@gmail.com';
  RAISE NOTICE '📊 Total de pedidos (orders) com email corrigido: %', v_orders_count;
  RAISE NOTICE '📊 Total de quizzes com email corrigido: %', v_quizzes_count;
  RAISE NOTICE '📊 Total de logs de email (email_logs) com email corrigido: %', v_email_logs_count;
END $$;

