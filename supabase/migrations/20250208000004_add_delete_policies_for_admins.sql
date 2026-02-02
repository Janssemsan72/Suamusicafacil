-- ==========================================
-- Adicionar políticas RLS para admins poderem excluir funis
-- ==========================================
-- Esta migration adiciona políticas DELETE para admins nas 3 tabelas de funil

-- Políticas RLS: Admins podem excluir
DROP POLICY IF EXISTS "Admins can delete funnel_pending" ON whatsapp_funnel_pending;
CREATE POLICY "Admins can delete funnel_pending" ON whatsapp_funnel_pending
  FOR DELETE USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role::text = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete funnel_completed" ON whatsapp_funnel_completed;
CREATE POLICY "Admins can delete funnel_completed" ON whatsapp_funnel_completed
  FOR DELETE USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role::text = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete funnel_exited" ON whatsapp_funnel_exited;
CREATE POLICY "Admins can delete funnel_exited" ON whatsapp_funnel_exited
  FOR DELETE USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role::text = 'admin'
    )
  );

-- Comentários
COMMENT ON POLICY "Admins can delete funnel_pending" ON whatsapp_funnel_pending IS 
'Permite que usuários com role admin excluam funis da tabela pending';

COMMENT ON POLICY "Admins can delete funnel_completed" ON whatsapp_funnel_completed IS 
'Permite que usuários com role admin excluam funis da tabela completed';

COMMENT ON POLICY "Admins can delete funnel_exited" ON whatsapp_funnel_exited IS 
'Permite que usuários com role admin excluam funis da tabela exited';

