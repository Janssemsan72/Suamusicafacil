-- ==========================================
-- TRIGGER: Auto-aprovar letra quando job for enviado para Suno
-- ==========================================
-- Este trigger garante que quando um job receber suno_task_id,
-- a letra associada seja automaticamente aprovada (status 'pending' -> 'approved')
-- ==========================================

CREATE OR REPLACE FUNCTION trigger_auto_aprovar_letra_ao_enviar_suno()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_approval_id UUID;
BEGIN
  -- Só processar se o job recebeu suno_task_id (não tinha antes e agora tem)
  IF (OLD.suno_task_id IS NULL OR OLD.suno_task_id = '') 
     AND NEW.suno_task_id IS NOT NULL 
     AND NEW.suno_task_id != '' THEN
    
    -- Buscar a lyrics_approval pendente associada a este job
    SELECT id INTO v_approval_id
    FROM lyrics_approvals
    WHERE job_id = NEW.id
      AND status = 'pending'
    LIMIT 1;
    
    -- Se encontrou uma aprovação pendente, aprovar automaticamente
    IF v_approval_id IS NOT NULL THEN
      UPDATE lyrics_approvals
      SET 
        status = 'approved',
        approved_at = COALESCE(approved_at, NOW()),
        updated_at = NOW()
      WHERE id = v_approval_id;
      
      RAISE NOTICE '[Trigger] ✅ Letra aprovada automaticamente após envio para Suno - Approval ID: %, Job ID: %', v_approval_id, NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_auto_aprovar_letra_ao_enviar_suno ON jobs;

CREATE TRIGGER trigger_auto_aprovar_letra_ao_enviar_suno
  AFTER UPDATE OF suno_task_id ON jobs
  FOR EACH ROW
  WHEN (
    (OLD.suno_task_id IS NULL OR OLD.suno_task_id = '') 
    AND NEW.suno_task_id IS NOT NULL 
    AND NEW.suno_task_id != ''
  )
  EXECUTE FUNCTION trigger_auto_aprovar_letra_ao_enviar_suno();

-- Habilitar trigger
ALTER TABLE jobs ENABLE TRIGGER trigger_auto_aprovar_letra_ao_enviar_suno;

-- Comentários
COMMENT ON FUNCTION trigger_auto_aprovar_letra_ao_enviar_suno() IS 
'Função do trigger que automaticamente aprova letras quando o job associado recebe suno_task_id (foi enviado para o Suno). Move o status de pending para approved.';

COMMENT ON TRIGGER trigger_auto_aprovar_letra_ao_enviar_suno ON jobs IS 
'Trigger que dispara automaticamente quando um job recebe suno_task_id. Aprova a letra associada movendo de pending para approved.';

