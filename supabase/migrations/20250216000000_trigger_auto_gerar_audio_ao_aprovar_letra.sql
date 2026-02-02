-- ==========================================
-- TRIGGER: Auto-gerar áudio quando letra for aprovada
-- ==========================================
-- Este trigger garante que quando uma letra for aprovada,
-- o sistema automaticamente cria o suno_task_id e inicia
-- a geração da música no Suno
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
  v_has_suno_task_id BOOLEAN;
  v_order_status TEXT;
BEGIN
  -- Só processar se o status mudou para 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    v_job_id := NEW.job_id;
    
    RAISE NOTICE '[Trigger] Letra aprovada: % para job: %', NEW.id, v_job_id;
    
    -- Verificar se o job já tem suno_task_id
    SELECT 
      (suno_task_id IS NOT NULL AND suno_task_id != '') INTO v_has_suno_task_id
    FROM jobs
    WHERE id = v_job_id;
    
    -- Verificar se o pedido está pago
    SELECT o.status INTO v_order_status
    FROM jobs j
    INNER JOIN orders o ON j.order_id = o.id
    WHERE j.id = v_job_id;
    
    -- Só gerar se:
    -- 1. Job não tem suno_task_id ainda
    -- 2. Pedido está pago
    IF NOT v_has_suno_task_id AND v_order_status = 'paid' THEN
      RAISE NOTICE '[Trigger] Job % não tem suno_task_id, iniciando geração de áudio...', v_job_id;
      
      -- Obter configurações do Supabase
      v_supabase_url := current_setting('app.settings.supabase_url', true);
      v_service_key := current_setting('app.settings.supabase_service_role_key', true);
      
      -- Se não tiver configurações, usar valores padrão
      IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
        v_supabase_url := 'https://zagkvtxarndluusiluhb.supabase.co';
      END IF;
      
      -- Se não tiver service key, tentar obter do vault
      IF v_service_key IS NULL OR v_service_key = '' THEN
        BEGIN
          SELECT decrypted_secret INTO v_service_key
          FROM vault.decrypted_secrets
          WHERE name = 'supabase_service_role_key'
          LIMIT 1;
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING '[Trigger] Não foi possível obter service key do vault: %', SQLERRM;
          RETURN NEW; -- Retornar sem erro para não bloquear a aprovação
        END;
      END IF;
      
      -- Chamar função generate-audio-internal via pg_net (assíncrono)
      BEGIN
        PERFORM net.http_post(
          url := v_supabase_url || '/functions/v1/generate-audio-internal',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_key
          ),
          body := jsonb_build_object(
            'job_id', v_job_id::text
          )
        );
        
        RAISE NOTICE '[Trigger] ✅ generate-audio-internal chamado para job %', v_job_id;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[Trigger] ⚠️ Erro ao chamar generate-audio-internal para job %: %', v_job_id, SQLERRM;
        -- Não bloquear a aprovação se houver erro na chamada
      END;
    ELSE
      IF v_has_suno_task_id THEN
        RAISE NOTICE '[Trigger] Job % já tem suno_task_id, pulando geração', v_job_id;
      END IF;
      IF v_order_status != 'paid' THEN
        RAISE NOTICE '[Trigger] Pedido do job % não está pago (status: %), pulando geração', v_job_id, v_order_status;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_auto_gerar_audio_ao_aprovar_letra ON lyrics_approvals;

CREATE TRIGGER trigger_auto_gerar_audio_ao_aprovar_letra
  AFTER UPDATE OF status ON lyrics_approvals
  FOR EACH ROW
  WHEN (NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved'))
  EXECUTE FUNCTION trigger_auto_gerar_audio_ao_aprovar_letra();

-- Habilitar trigger
ALTER TABLE lyrics_approvals ENABLE TRIGGER trigger_auto_gerar_audio_ao_aprovar_letra;

-- Comentários
COMMENT ON FUNCTION trigger_auto_gerar_audio_ao_aprovar_letra() IS 
'Função do trigger que automaticamente inicia a geração de áudio no Suno quando uma letra é aprovada. Verifica se o job já tem suno_task_id e se o pedido está pago antes de chamar generate-audio-internal.';

COMMENT ON TRIGGER trigger_auto_gerar_audio_ao_aprovar_letra ON lyrics_approvals IS 
'Trigger que dispara automaticamente a geração de áudio quando uma letra é aprovada (status muda para approved). Garante que o suno_task_id seja criado e a música seja gerada no Suno.';



