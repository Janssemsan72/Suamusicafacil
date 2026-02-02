-- ==========================================
-- Adicionar política RLS pública para UPDATE em behavior_analytics
-- Permite que a Edge Function atualize contadores de eventos
-- ==========================================

-- Política: Permitir UPDATE público para incrementar contadores
-- Esta política permite que a Edge Function atualize registros existentes
-- para incrementar event_count e atualizar metadata
-- A função usa service_role quando disponível, mas esta política garante
-- que funcione mesmo sem service_role configurado
DROP POLICY IF EXISTS "Public can update behavior_analytics" ON behavior_analytics;
CREATE POLICY "Public can update behavior_analytics"
  ON behavior_analytics FOR UPDATE
  USING (true)  -- Permite atualizar qualquer registro existente
  WITH CHECK (true);  -- Permite qualquer atualização

-- Comentário explicativo
COMMENT ON POLICY "Public can update behavior_analytics" ON behavior_analytics IS 
  'Permite que Edge Functions atualizem contadores de eventos. ' ||
  'A função valida os dados antes de atualizar.';

