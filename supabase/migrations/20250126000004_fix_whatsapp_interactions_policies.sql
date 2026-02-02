-- ==========================================
-- Fix: Tornar policies idempotentes
-- Execute este script se a migration principal falhar
-- ==========================================

-- Dropar policies se existirem
DROP POLICY IF EXISTS "Service role can manage whatsapp_interactions" ON whatsapp_interactions;
DROP POLICY IF EXISTS "Admins can view whatsapp_interactions" ON whatsapp_interactions;

-- Recriar policies
CREATE POLICY "Service role can manage whatsapp_interactions" ON whatsapp_interactions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Admins can view whatsapp_interactions" ON whatsapp_interactions
  FOR SELECT USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role::text = 'admin'
    )
  );

