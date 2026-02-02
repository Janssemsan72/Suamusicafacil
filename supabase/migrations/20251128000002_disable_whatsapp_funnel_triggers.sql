-- ==========================================
-- DESABILITAR TRIGGERS DE WHATSAPP FUNNEL
-- ==========================================
-- Remove triggers que criam funis WhatsApp automaticamente
-- WhatsApp foi removido do sistema - não deve ser usado
-- ==========================================

-- Desabilitar triggers que criam funis automaticamente
DROP TRIGGER IF EXISTS trigger_auto_create_funnel_on_insert ON orders;
DROP TRIGGER IF EXISTS trigger_auto_create_funnel_on_update ON orders;

-- Comentário explicativo
COMMENT ON FUNCTION trigger_auto_create_funnel() IS 
'DESABILITADO: Trigger desabilitado - WhatsApp foi removido do sistema. Funis não são mais criados automaticamente.';









