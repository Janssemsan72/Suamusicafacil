-- ==========================================
-- Adicionar política de DELETE para behavior_analytics
-- ==========================================
-- Permite que admins deletem registros da tabela behavior_analytics
-- ==========================================

-- Política: Apenas admins podem deletar
DROP POLICY IF EXISTS "Admins can delete behavior_analytics" ON behavior_analytics;
CREATE POLICY "Admins can delete behavior_analytics"
  ON behavior_analytics FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );


