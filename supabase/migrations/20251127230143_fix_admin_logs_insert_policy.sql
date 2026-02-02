-- Fix admin_logs INSERT policy
-- O erro PGRST204 ocorre porque a tabela admin_logs tem RLS habilitado
-- mas não possui política de INSERT, impedindo que Edge Functions e usuários
-- autenticados insiram logs de auditoria.

-- Adicionar política de INSERT para service role (Edge Functions)
-- Service role pode inserir logs sem restrições
CREATE POLICY "Service role can insert admin logs"
ON admin_logs
FOR INSERT
WITH CHECK (auth.role() = 'service_role');

-- Adicionar política de INSERT para usuários autenticados com role admin
-- Admins podem inserir logs manualmente se necessário
CREATE POLICY "Admins can insert admin logs"
ON admin_logs
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role::text = 'admin'
  )
);

