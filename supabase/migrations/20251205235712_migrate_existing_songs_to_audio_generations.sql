-- ==========================================
-- Migration: Preencher audio_generations com dados de músicas existentes
-- ==========================================
-- Esta migration busca todas as songs que têm audio_url mas não têm registro em audio_generations
-- e tenta criar registros com os dados disponíveis (suno_task_id, suno_clip_id, etc.)
-- ==========================================

-- Inserir registros em audio_generations para songs existentes que não têm registro
INSERT INTO audio_generations (
  generation_task_id,
  audio_id,
  audio_url,
  song_id,
  job_id,
  order_id,
  status,
  completed_at,
  created_at,
  updated_at
)
SELECT DISTINCT ON (s.id)
  COALESCE(s.suno_task_id, j.suno_task_id) as generation_task_id,
  s.suno_clip_id as audio_id,
  s.audio_url,
  s.id as song_id,
  s.job_id,
  s.order_id,
  CASE 
    WHEN s.audio_url IS NOT NULL AND s.audio_url != '' THEN 'completed'::audio_generation_status
    ELSE 'pending'::audio_generation_status
  END as status,
  CASE 
    WHEN s.audio_url IS NOT NULL AND s.audio_url != '' THEN s.updated_at
    ELSE NULL
  END as completed_at,
  s.created_at,
  s.updated_at
FROM songs s
LEFT JOIN jobs j ON s.job_id = j.id
WHERE 
  -- Song tem audio_url (já foi gerada)
  s.audio_url IS NOT NULL 
  AND s.audio_url != ''
  -- E não tem registro em audio_generations ainda
  AND NOT EXISTS (
    SELECT 1 
    FROM audio_generations ag 
    WHERE ag.song_id = s.id
  )
  -- E tem pelo menos suno_task_id ou suno_clip_id
  AND (
    s.suno_task_id IS NOT NULL 
    OR s.suno_clip_id IS NOT NULL
    OR j.suno_task_id IS NOT NULL
  )
ORDER BY s.id, s.created_at DESC
ON CONFLICT (generation_task_id) DO NOTHING;

-- Log do resultado
DO $$
DECLARE
  inserted_count INTEGER;
BEGIN
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RAISE NOTICE 'Migração concluída: % registros inseridos em audio_generations', inserted_count;
END $$;

