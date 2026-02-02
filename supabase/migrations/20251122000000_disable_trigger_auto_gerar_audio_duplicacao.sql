-- ==========================================
-- CORREÇÃO: Desabilitar trigger que causa duplicação de envio para Suno
-- ==========================================
-- PROBLEMA: Quando uma letra é aprovada via admin-approve-lyrics,
-- o trigger trigger_auto_gerar_audio_ao_aprovar_letra também dispara,
-- causando duplicação de chamadas para generate-audio-internal.
-- 
-- SOLUÇÃO: Desabilitar o trigger, pois a função admin-approve-lyrics
-- já gerencia corretamente as chamadas para generate-audio-internal
-- (gerando 3 versões de forma controlada).
-- ==========================================

-- Desabilitar trigger que causa duplicação
ALTER TABLE lyrics_approvals DISABLE TRIGGER trigger_auto_gerar_audio_ao_aprovar_letra;

-- Comentário explicativo
COMMENT ON TRIGGER trigger_auto_gerar_audio_ao_aprovar_letra ON lyrics_approvals IS 
'Trigger desabilitado para evitar duplicação. A função admin-approve-lyrics já gerencia a geração de áudio de forma controlada.';








