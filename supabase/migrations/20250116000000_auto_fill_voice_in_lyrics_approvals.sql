-- Trigger para preencher automaticamente o campo voice em lyrics_approvals
-- baseado no vocal_gender do quiz associado quando uma approval é criada

CREATE OR REPLACE FUNCTION auto_fill_voice_from_quiz()
RETURNS TRIGGER AS $$
BEGIN
  -- Se voice não foi definido, preencher baseado no quiz.vocal_gender
  IF NEW.voice IS NULL OR NEW.voice = '' THEN
    SELECT CASE
      WHEN q.vocal_gender = 'm' OR q.vocal_gender = 'M' THEN 'M'
      WHEN q.vocal_gender = 'f' OR q.vocal_gender = 'F' THEN 'F'
      ELSE 'S' -- Sem preferência (padrão)
    END INTO NEW.voice
    FROM public.quizzes q
    WHERE q.id = NEW.quiz_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger BEFORE INSERT para preencher voice automaticamente
DROP TRIGGER IF EXISTS trigger_auto_fill_voice_from_quiz ON public.lyrics_approvals;
CREATE TRIGGER trigger_auto_fill_voice_from_quiz
  BEFORE INSERT ON public.lyrics_approvals
  FOR EACH ROW
  EXECUTE FUNCTION auto_fill_voice_from_quiz();

-- Comentário explicativo
COMMENT ON FUNCTION auto_fill_voice_from_quiz() IS 'Preenche automaticamente o campo voice em lyrics_approvals baseado no vocal_gender do quiz associado quando uma approval é criada.';











