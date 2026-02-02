-- ✅ MIGRAÇÃO CRÍTICA: Garantir que audio_url sempre seja preenchido
-- Esta migração cria triggers e funções para garantir consistência entre jobs.suno_audio_url e songs.audio_url

-- 1. Função para sincronizar audio_url de jobs para songs quando job é completado
CREATE OR REPLACE FUNCTION sync_audio_url_from_job_to_songs()
RETURNS TRIGGER AS $$
BEGIN
  -- Quando um job é marcado como 'completed' e tem suno_audio_url
  IF NEW.status = 'completed' AND NEW.suno_audio_url IS NOT NULL AND NEW.suno_audio_url != '' THEN
    -- Atualizar todas as songs do pedido que não têm audio_url
    UPDATE songs
    SET 
      audio_url = NEW.suno_audio_url,
      updated_at = NOW()
    WHERE 
      order_id = NEW.order_id
      AND (audio_url IS NULL OR audio_url = '');
    
    -- Log da sincronização
    RAISE NOTICE 'Sincronizado audio_url do job % para songs do pedido %', NEW.id, NEW.order_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Trigger para executar a sincronização quando job é atualizado
DROP TRIGGER IF EXISTS trigger_sync_audio_url_from_job ON jobs;
CREATE TRIGGER trigger_sync_audio_url_from_job
  AFTER UPDATE ON jobs
  FOR EACH ROW
  WHEN (
    NEW.status = 'completed' 
    AND NEW.suno_audio_url IS NOT NULL 
    AND NEW.suno_audio_url != ''
    AND (OLD.suno_audio_url IS NULL OR OLD.suno_audio_url = '' OR OLD.status != 'completed')
  )
  EXECUTE FUNCTION sync_audio_url_from_job_to_songs();

-- 3. Função para corrigir jobs completos sem suno_audio_url (verificar songs)
CREATE OR REPLACE FUNCTION fix_jobs_without_audio_url()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_job RECORD;
  v_audio_url TEXT;
BEGIN
  -- Buscar jobs completos sem suno_audio_url que têm songs com audio_url
  FOR v_job IN
    SELECT DISTINCT j.id, j.order_id
    FROM jobs j
    WHERE j.status = 'completed'
      AND (j.suno_audio_url IS NULL OR j.suno_audio_url = '')
      AND EXISTS (
        SELECT 1 FROM songs s
        WHERE s.order_id = j.order_id
          AND s.audio_url IS NOT NULL
          AND s.audio_url != ''
      )
  LOOP
    -- Pegar o primeiro audio_url das songs do pedido
    SELECT audio_url INTO v_audio_url
    FROM songs
    WHERE order_id = v_job.order_id
      AND audio_url IS NOT NULL
      AND audio_url != ''
    ORDER BY created_at ASC
    LIMIT 1;
    
    -- Atualizar job com suno_audio_url
    IF v_audio_url IS NOT NULL THEN
      UPDATE jobs
      SET 
        suno_audio_url = v_audio_url,
        updated_at = NOW()
      WHERE id = v_job.id;
      
      v_count := v_count + 1;
      RAISE NOTICE 'Corrigido job % com audio_url da song', v_job.id;
    END IF;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- 4. Função para corrigir songs sem audio_url (verificar jobs)
CREATE OR REPLACE FUNCTION fix_songs_without_audio_url()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_song RECORD;
  v_audio_url TEXT;
BEGIN
  -- Buscar songs sem audio_url que têm jobs com suno_audio_url
  FOR v_song IN
    SELECT s.id, s.order_id
    FROM songs s
    WHERE (s.audio_url IS NULL OR s.audio_url = '')
      AND EXISTS (
        SELECT 1 FROM jobs j
        WHERE j.order_id = s.order_id
          AND j.suno_audio_url IS NOT NULL
          AND j.suno_audio_url != ''
      )
  LOOP
    -- Pegar o suno_audio_url do job mais recente
    SELECT suno_audio_url INTO v_audio_url
    FROM jobs
    WHERE order_id = v_song.order_id
      AND suno_audio_url IS NOT NULL
      AND suno_audio_url != ''
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Atualizar song com audio_url
    IF v_audio_url IS NOT NULL THEN
      UPDATE songs
      SET 
        audio_url = v_audio_url,
        updated_at = NOW()
      WHERE id = v_song.id;
      
      v_count := v_count + 1;
      RAISE NOTICE 'Corrigido song % com audio_url do job', v_song.id;
    END IF;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- 5. Executar correções imediatas
DO $$
DECLARE
  v_jobs_fixed INTEGER;
  v_songs_fixed INTEGER;
BEGIN
  RAISE NOTICE 'Iniciando correção de inconsistências...';
  
  -- Corrigir jobs sem suno_audio_url
  SELECT fix_jobs_without_audio_url() INTO v_jobs_fixed;
  RAISE NOTICE 'Jobs corrigidos: %', v_jobs_fixed;
  
  -- Corrigir songs sem audio_url
  SELECT fix_songs_without_audio_url() INTO v_songs_fixed;
  RAISE NOTICE 'Songs corrigidas: %', v_songs_fixed;
  
  RAISE NOTICE 'Correção concluída!';
END $$;

-- 6. Comentários de documentação
COMMENT ON FUNCTION sync_audio_url_from_job_to_songs() IS 'Sincroniza automaticamente audio_url de jobs para songs quando job é completado';
COMMENT ON FUNCTION fix_jobs_without_audio_url() IS 'Corrige jobs completos sem suno_audio_url usando audio_url das songs';
COMMENT ON FUNCTION fix_songs_without_audio_url() IS 'Corrige songs sem audio_url usando suno_audio_url dos jobs';
COMMENT ON TRIGGER trigger_sync_audio_url_from_job ON jobs IS 'Trigger que sincroniza audio_url automaticamente quando job é completado';



