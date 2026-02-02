-- ==========================================
-- GARANTIR QUE TRIGGER ESTÁ DESABILITADO PARA EVITAR DUPLICAÇÃO
-- ==========================================
-- Este script garante que o trigger trigger_auto_gerar_audio_ao_aprovar_letra
-- esteja desabilitado para evitar que ele e a função admin-approve-lyrics
-- chamem generate-audio-internal simultaneamente, causando duplicação.
-- ==========================================

-- Desabilitar trigger que causa duplicação
ALTER TABLE lyrics_approvals DISABLE TRIGGER trigger_auto_gerar_audio_ao_aprovar_letra;

-- Verificar se o trigger está desabilitado
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM pg_trigger 
    WHERE tgname = 'trigger_auto_gerar_audio_ao_aprovar_letra' 
    AND tgenabled = 'D'
  ) THEN
    RAISE NOTICE '✅ Trigger trigger_auto_gerar_audio_ao_aprovar_letra está DESABILITADO';
  ELSE
    RAISE WARNING '⚠️ Trigger trigger_auto_gerar_audio_ao_aprovar_letra NÃO está desabilitado!';
  END IF;
END $$;

-- Comentário explicativo
COMMENT ON TRIGGER trigger_auto_gerar_audio_ao_aprovar_letra ON lyrics_approvals IS 
'Trigger desabilitado para evitar duplicação. A função admin-approve-lyrics já gerencia a geração de áudio de forma controlada.';

