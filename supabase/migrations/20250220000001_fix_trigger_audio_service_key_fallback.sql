-- ==========================================
-- CORRIGIR TRIGGER AUDIO COM FALLBACK DE SERVICE KEY
-- Adiciona fallback hardcoded para service key quando vault não está disponível
-- ==========================================

CREATE OR REPLACE FUNCTION trigger_auto_gerar_audio_ao_aprovar_letra()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_supabase_url TEXT;
  v_service_key TEXT;
  v_job_id UUID;
  v_order_status TEXT;
  -- ✅ FALLBACK: Service key hardcoded como último recurso
  v_fallback_service_key TEXT := 'qM0vOWB8qMNHCbAK4uwLMdM3q0N/jYI46/LfMfH6Q5ozca5RNnf5JBfguSGTHxWGeUAtj89VQzUGNb25iXpYyw==';
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    v_job_id := NEW.job_id;
    
    RAISE NOTICE '🎵 [Trigger Audio] Letra aprovada: % para job: %', NEW.id, v_job_id;
    
    -- Verificar se pedido está pago
    SELECT o.status INTO v_order_status
    FROM jobs j
    INNER JOIN orders o ON j.order_id = o.id
    WHERE j.id = v_job_id;
    
    -- ✅ CORREÇÃO: Sempre gerar áudio quando letra for aprovada e pedido estiver pago
    IF v_order_status = 'paid' THEN
      RAISE NOTICE '🎵 [Trigger Audio] Iniciando geração de áudio para job %', v_job_id;
      
      -- Obter configurações com valor padrão SEMPRE definido
      BEGIN
        v_supabase_url := current_setting('app.settings.supabase_url', true);
        v_service_key := current_setting('app.settings.supabase_service_role_key', true);
      EXCEPTION WHEN OTHERS THEN
        v_supabase_url := NULL;
        v_service_key := NULL;
      END;
      
      -- ✅ CORREÇÃO CRÍTICA: SEMPRE garantir URL válida antes de qualquer operação
      IF v_supabase_url IS NULL OR TRIM(v_supabase_url) = '' THEN
        v_supabase_url := 'https://zagkvtxarndluusiluhb.supabase.co';
        RAISE NOTICE '⚠️ [Trigger Audio] Usando URL padrão hardcoded: %', v_supabase_url;
      END IF;
      
      -- ✅ FALLBACK: Usar service key hardcoded se não tiver em app.settings
      IF v_service_key IS NULL OR TRIM(v_service_key) = '' THEN
        v_service_key := v_fallback_service_key;
        RAISE NOTICE '✅ [Trigger Audio] Usando service key fallback hardcoded';
      ELSE
        RAISE NOTICE '✅ [Trigger Audio] Service key obtida de app.settings';
      END IF;
      
      -- ✅ VALIDAÇÃO FINAL: Verificar se temos URL e service key válidos antes de continuar
      IF v_supabase_url IS NULL OR TRIM(v_supabase_url) = '' THEN
        RAISE WARNING '❌ [Trigger Audio] URL do Supabase não pode ser NULL ou vazia - abortando processamento para job %', v_job_id;
        RETURN NEW;
      END IF;
      
      IF v_service_key IS NULL OR TRIM(v_service_key) = '' THEN
        RAISE WARNING '❌ [Trigger Audio] Service key não disponível - abortando processamento para job %', v_job_id;
        RETURN NEW;
      END IF;
      
      -- Chamar função generate-audio-internal
      BEGIN
        PERFORM net.http_post(
          url := v_supabase_url || '/functions/v1/generate-audio-internal',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_key
          ),
          body := jsonb_build_object('job_id', v_job_id::text),
          timeout_milliseconds := 5000
        );
        RAISE NOTICE '✅ [Trigger Audio] generate-audio-internal chamado para job %', v_job_id;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '⚠️ [Trigger Audio] Erro ao chamar generate-audio-internal: %', SQLERRM;
      END;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION trigger_auto_gerar_audio_ao_aprovar_letra() IS 
'Função do trigger que automaticamente inicia a geração de áudio no Suno quando uma letra é aprovada. 
Tenta obter service key de: 1) app.settings, 2) fallback hardcoded (vault não disponível no Supabase).';

