-- Atualizar registros existentes de lyrics_approvals que não têm voice definido
-- Usar vocal_gender do quiz associado para preencher o campo voice

UPDATE public.lyrics_approvals la
SET voice = CASE
  WHEN q.vocal_gender = 'm' OR q.vocal_gender = 'M' THEN 'M'
  WHEN q.vocal_gender = 'f' OR q.vocal_gender = 'F' THEN 'F'
  ELSE 'S' -- Sem preferência (padrão)
END
FROM public.quizzes q
WHERE la.quiz_id = q.id
  AND (la.voice IS NULL OR la.voice = '');

-- Comentário explicativo
COMMENT ON COLUMN public.lyrics_approvals.voice IS 'Voz da música: M (Masculino), F (Feminino), S (Sem preferência). Preenchido automaticamente do vocal_gender do quiz ao criar a aprovação.';

