-- ============================================================
-- CORRIGIR ACESSO RLS DA TABELA ORDERS
-- ============================================================
-- Esta migration garante que a tabela orders seja acessível
-- para leitura via API do Supabase
-- ============================================================

-- 1. Verificar se RLS está habilitado
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'orders'
  ) THEN
    RAISE EXCEPTION 'Tabela orders não existe';
  END IF;
END $$;

-- 2. Garantir que RLS está habilitado
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 3. Remover políticas problemáticas que podem estar bloqueando acesso
DROP POLICY IF EXISTS "Prevent paid order modification" ON public.orders;
DROP POLICY IF EXISTS "Users can create own orders" ON public.orders;
DROP POLICY IF EXISTS "Allow order creation" ON public.orders;
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can update orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can read orders" ON public.orders;
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Allow all operations on orders" ON public.orders;
DROP POLICY IF EXISTS "Public can read orders" ON public.orders;
DROP POLICY IF EXISTS "Public can select orders" ON public.orders;

-- 4. Criar política permissiva para SELECT (leitura)
CREATE POLICY "Public can select orders"
ON public.orders
FOR SELECT
USING (true);

-- 5. Criar política permissiva para INSERT (criação)
CREATE POLICY "Public can insert orders"
ON public.orders
FOR INSERT
WITH CHECK (true);

-- 6. Criar política permissiva para UPDATE (atualização)
CREATE POLICY "Public can update orders"
ON public.orders
FOR UPDATE
USING (true)
WITH CHECK (true);

-- 7. Verificar se as políticas foram criadas
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
  AND tablename = 'orders';
  
  IF policy_count = 0 THEN
    RAISE WARNING 'Nenhuma política RLS encontrada para a tabela orders';
  ELSE
    RAISE NOTICE 'Políticas RLS criadas com sucesso. Total: %', policy_count;
  END IF;
END $$;

-- 8. Comentários
COMMENT ON POLICY "Public can select orders" ON public.orders IS 
'Permite leitura pública da tabela orders via API do Supabase';

COMMENT ON POLICY "Public can insert orders" ON public.orders IS 
'Permite inserção pública na tabela orders via API do Supabase';

COMMENT ON POLICY "Public can update orders" ON public.orders IS 
'Permite atualização pública da tabela orders via API do Supabase';

