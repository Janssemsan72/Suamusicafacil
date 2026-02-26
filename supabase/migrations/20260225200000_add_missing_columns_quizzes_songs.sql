-- ==========================================
-- Adicionar colunas faltantes nas tabelas quizzes e songs
-- Resolve erros 400 no admin ao carregar detalhes de pedido
-- ==========================================

-- QUIZZES: Adicionar music_prompt (texto do prompt de música usado no admin)
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS music_prompt TEXT;

-- SONGS: Adicionar quiz_id (referência ao quiz que gerou a música)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'songs' AND column_name = 'quiz_id'
  ) THEN
    ALTER TABLE songs ADD COLUMN quiz_id UUID REFERENCES quizzes(id) ON DELETE SET NULL;
  END IF;
END $$;

-- SONGS: Adicionar vocals_url e instrumental_url (URLs de stems separados)
ALTER TABLE songs ADD COLUMN IF NOT EXISTS vocals_url TEXT;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS instrumental_url TEXT;

-- SONGS: Garantir variant_number, release_at, released_at (podem já existir de migração anterior)
ALTER TABLE songs ADD COLUMN IF NOT EXISTS variant_number INTEGER DEFAULT 1;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS release_at TIMESTAMPTZ;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;
