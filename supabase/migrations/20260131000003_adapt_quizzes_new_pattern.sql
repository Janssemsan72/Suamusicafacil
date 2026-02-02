-- ==========================================
-- Adaptar schema quizzes ao novo padrão simplificado
-- Novo padrão: about_who, relationship, occasion, style, vocal_gender, message (preenchidos)
-- Legado: qualities, memories, key_moments (nullable - quiz antigo multi-step)
-- ==========================================

-- Garantir que qualities, memories, key_moments sejam nullable (novo quiz não preenche)
DO $$
BEGIN
  -- qualities
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quizzes' AND column_name = 'qualities'
  ) THEN
    ALTER TABLE quizzes ALTER COLUMN qualities DROP NOT NULL;
  END IF;

  -- memories
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quizzes' AND column_name = 'memories'
  ) THEN
    ALTER TABLE quizzes ALTER COLUMN memories DROP NOT NULL;
  END IF;

  -- key_moments
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quizzes' AND column_name = 'key_moments'
  ) THEN
    ALTER TABLE quizzes ALTER COLUMN key_moments DROP NOT NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Ignorar se coluna já for nullable ou não existir
  NULL;
END $$;

-- Documentar padrão novo vs legado
COMMENT ON COLUMN quizzes.qualities IS 'Legado: qualidades da pessoa. Novo padrão: null, contexto em message.';
COMMENT ON COLUMN quizzes.memories IS 'Legado: memórias compartilhadas. Novo padrão: null, contexto em message.';
COMMENT ON COLUMN quizzes.key_moments IS 'Legado: momentos importantes. Novo padrão: null, contexto em message.';
COMMENT ON COLUMN quizzes.message IS 'História/mensagem/letra. Novo padrão: fonte única de contexto quando qualities/memories/key_moments vazios.';
