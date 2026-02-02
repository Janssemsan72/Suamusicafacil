-- ==========================================
-- Corrigir RLS para admins poderem ver funis WhatsApp
-- Execute este script se a migration principal já foi executada
-- ==========================================

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Admins can view whatsapp_funnel" ON whatsapp_funnel;
DROP POLICY IF EXISTS "Admins can view whatsapp_messages" ON whatsapp_messages;
DROP POLICY IF EXISTS "Admins can view checkout_links" ON checkout_links;

-- Políticas RLS: Admins podem visualizar tudo
CREATE POLICY "Admins can view whatsapp_funnel" ON whatsapp_funnel
  FOR SELECT USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role::text = 'admin'
    )
  );

CREATE POLICY "Admins can view whatsapp_messages" ON whatsapp_messages
  FOR SELECT USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role::text = 'admin'
    )
  );

CREATE POLICY "Admins can view checkout_links" ON checkout_links
  FOR SELECT USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role::text = 'admin'
    )
  );

