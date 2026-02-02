-- ============================================================
-- MIGRAÇÃO: Criar tabelas faltantes e corrigir queries
-- Data: 2025-01-25
-- Descrição: Cria tabelas jobs, suno_credits, collaborator_permissions
--            e ajusta estrutura para compatibilidade
-- ============================================================

-- ============================================================
-- 1. CRIAR ENUMS SE NÃO EXISTIREM
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_status') THEN
    CREATE TYPE job_status AS ENUM ('pending', 'processing', 'completed', 'failed');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'song_status') THEN
    CREATE TYPE song_status AS ENUM ('pending', 'ready', 'released');
  END IF;
END $$;

-- ============================================================
-- 2. CRIAR TABELA JOBS
-- ============================================================
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID REFERENCES quizzes(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  gpt_prompt TEXT,
  gpt_lyrics JSONB,
  suno_task_id TEXT,
  suno_audio_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para jobs
CREATE INDEX IF NOT EXISTS idx_jobs_order_id ON jobs(order_id);
CREATE INDEX IF NOT EXISTS idx_jobs_quiz_id ON jobs(quiz_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);

-- RLS para jobs
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- Políticas básicas para jobs (permissivas para admin)
DROP POLICY IF EXISTS "jobs_public_read" ON jobs;
CREATE POLICY "jobs_public_read" ON jobs
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "jobs_public_write" ON jobs;
CREATE POLICY "jobs_public_write" ON jobs
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 3. CRIAR TABELA SUNO_CREDITS (com estrutura compatível)
-- ============================================================
CREATE TABLE IF NOT EXISTS suno_credits (
  id UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  -- Colunas compatíveis com diferentes versões
  credits INTEGER DEFAULT 0,
  credits_used INTEGER DEFAULT 0,
  total_credits INTEGER DEFAULT 0,
  used_credits INTEGER DEFAULT 0,
  remaining_credits INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir registro inicial
INSERT INTO suno_credits (id, credits, credits_used, total_credits, used_credits, remaining_credits, last_updated, last_updated_at)
VALUES ('00000000-0000-0000-0000-000000000000'::uuid, 0, 0, 0, 0, 0, NOW(), NOW())
ON CONFLICT (id) DO UPDATE
SET 
  last_updated = NOW(),
  last_updated_at = NOW(),
  updated_at = NOW();

-- Índice
CREATE INDEX IF NOT EXISTS idx_suno_credits_id ON suno_credits(id);

-- RLS para suno_credits
ALTER TABLE suno_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "suno_credits_public_read" ON suno_credits;
CREATE POLICY "suno_credits_public_read" ON suno_credits
  FOR SELECT USING (true);

-- ============================================================
-- 4. CRIAR TABELA COLLABORATOR_PERMISSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS collaborator_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  permission_key TEXT NOT NULL,
  granted BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, permission_key)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_collaborator_permissions_user_id ON collaborator_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_collaborator_permissions_permission_key ON collaborator_permissions(permission_key);

-- RLS
ALTER TABLE collaborator_permissions ENABLE ROW LEVEL SECURITY;

-- Políticas
DROP POLICY IF EXISTS "Users can view their own permissions" ON collaborator_permissions;
CREATE POLICY "Users can view their own permissions"
ON collaborator_permissions FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all permissions" ON collaborator_permissions;
CREATE POLICY "Admins can view all permissions"
ON collaborator_permissions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
  )
);

DROP POLICY IF EXISTS "Admins can insert permissions" ON collaborator_permissions;
CREATE POLICY "Admins can insert permissions"
ON collaborator_permissions FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
  )
);

DROP POLICY IF EXISTS "Admins can update permissions" ON collaborator_permissions;
CREATE POLICY "Admins can update permissions"
ON collaborator_permissions FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
  )
);

DROP POLICY IF EXISTS "Admins can delete permissions" ON collaborator_permissions;
CREATE POLICY "Admins can delete permissions"
ON collaborator_permissions FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
  )
);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_collaborator_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_collaborator_permissions_updated_at ON collaborator_permissions;
CREATE TRIGGER trigger_update_collaborator_permissions_updated_at
  BEFORE UPDATE ON collaborator_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_collaborator_permissions_updated_at();

-- ============================================================
-- 5. CRIAR TABELA QUIZ_METRICS (se não existir)
-- ============================================================
CREATE TABLE IF NOT EXISTS quiz_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_date DATE NOT NULL,
  quizzes_saved INTEGER DEFAULT 0,
  quizzes_saved_with_session_id INTEGER DEFAULT 0,
  orders_created INTEGER DEFAULT 0,
  orders_with_quiz INTEGER DEFAULT 0,
  orders_without_quiz INTEGER DEFAULT 0,
  quizzes_lost INTEGER DEFAULT 0,
  retry_queue_size INTEGER DEFAULT 0,
  success_rate NUMERIC DEFAULT 0,
  session_id_adoption_rate NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(metric_date)
);

-- Índice
CREATE INDEX IF NOT EXISTS idx_quiz_metrics_date ON quiz_metrics(metric_date DESC);

-- ============================================================
-- 6. CRIAR TABELA QUIZ_RETRY_QUEUE (se não existir - pode ser referenciada)
-- ============================================================
CREATE TABLE IF NOT EXISTS quiz_retry_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quiz_retry_queue_status ON quiz_retry_queue(status);
CREATE INDEX IF NOT EXISTS idx_quiz_retry_queue_quiz_id ON quiz_retry_queue(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_retry_queue_order_id ON quiz_retry_queue(order_id);

-- ============================================================
-- 7. CRIAR FUNÇÃO get_quiz_metrics (se não existir)
-- ============================================================
CREATE OR REPLACE FUNCTION get_quiz_metrics(
  start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  metric_date DATE,
  quizzes_saved INTEGER,
  quizzes_saved_with_session_id INTEGER,
  orders_created INTEGER,
  orders_with_quiz INTEGER,
  orders_without_quiz INTEGER,
  quizzes_lost INTEGER,
  retry_queue_size INTEGER,
  success_rate NUMERIC,
  session_id_adoption_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    qm.metric_date,
    COALESCE(qm.quizzes_saved, 0)::INTEGER,
    COALESCE(qm.quizzes_saved_with_session_id, 0)::INTEGER,
    COALESCE(qm.orders_created, 0)::INTEGER,
    COALESCE(qm.orders_with_quiz, 0)::INTEGER,
    COALESCE(qm.orders_without_quiz, 0)::INTEGER,
    COALESCE(qm.quizzes_lost, 0)::INTEGER,
    COALESCE(qm.retry_queue_size, 0)::INTEGER,
    -- Taxa de sucesso: pedidos com quiz / pedidos criados
    CASE
      WHEN qm.orders_created > 0 THEN
        ROUND((qm.orders_with_quiz::NUMERIC / qm.orders_created::NUMERIC) * 100, 2)
      ELSE 0
    END AS success_rate,
    -- Taxa de adoção de session_id: quizzes com session_id / quizzes salvos
    CASE
      WHEN qm.quizzes_saved > 0 THEN
        ROUND((qm.quizzes_saved_with_session_id::NUMERIC / qm.quizzes_saved::NUMERIC) * 100, 2)
      ELSE 0
    END AS session_id_adoption_rate
  FROM quiz_metrics qm
  WHERE qm.metric_date BETWEEN start_date AND end_date
  ORDER BY qm.metric_date ASC;
END;
$$;

-- ============================================================
-- 7. VERIFICAÇÃO FINAL
-- ============================================================
DO $$
DECLARE
  jobs_exists BOOLEAN;
  suno_credits_exists BOOLEAN;
  collaborator_permissions_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'jobs'
  ) INTO jobs_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'suno_credits'
  ) INTO suno_credits_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'collaborator_permissions'
  ) INTO collaborator_permissions_exists;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '📊 TABELAS CRIADAS:';
  RAISE NOTICE '========================================';
  RAISE NOTICE '   jobs: %', CASE WHEN jobs_exists THEN '✅' ELSE '❌' END;
  RAISE NOTICE '   suno_credits: %', CASE WHEN suno_credits_exists THEN '✅' ELSE '❌' END;
  RAISE NOTICE '   collaborator_permissions: %', CASE WHEN collaborator_permissions_exists THEN '✅' ELSE '❌' END;
  RAISE NOTICE '========================================';
END $$;

