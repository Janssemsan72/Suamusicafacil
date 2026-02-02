-- ============================================================
-- MIGRAÇÃO: Garantir estrutura completa do banco de dados
-- Data: 2025-01-26
-- Descrição: Cria tabelas faltantes (jobs) e adiciona campos
--            faltantes na tabela orders para compatibilidade
--            com o código da aplicação
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
-- 2. ADICIONAR CAMPOS FALTANTES NA TABELA ORDERS
-- ============================================================
DO $$
BEGIN
  -- Adicionar amount_cents se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'amount_cents'
  ) THEN
    ALTER TABLE orders ADD COLUMN amount_cents INTEGER;
    RAISE NOTICE 'Campo amount_cents adicionado à tabela orders';
  END IF;

  -- Adicionar payment_provider se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'payment_provider'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_provider TEXT;
    RAISE NOTICE 'Campo payment_provider adicionado à tabela orders';
  END IF;

  -- Adicionar provider se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'provider'
  ) THEN
    ALTER TABLE orders ADD COLUMN provider TEXT;
    RAISE NOTICE 'Campo provider adicionado à tabela orders';
  END IF;

  -- Adicionar paid_at se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'paid_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN paid_at TIMESTAMPTZ;
    RAISE NOTICE 'Campo paid_at adicionado à tabela orders';
  END IF;
END $$;

-- ============================================================
-- 3. CRIAR TABELA JOBS SE NÃO EXISTIR
-- ============================================================
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID REFERENCES quizzes(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  gpt_prompt TEXT,
  gpt_lyrics JSONB,
  suno_task_id TEXT,
  suno_audio_url TEXT,
  suno_video_url TEXT,
  suno_cover_url TEXT,
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
-- 4. GARANTIR TABELA SUNO_CREDITS (com estrutura compatível)
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

-- Adicionar colunas faltantes se a tabela já existir
DO $$
BEGIN
  -- Adicionar used_credits se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'suno_credits' 
    AND column_name = 'used_credits'
  ) THEN
    ALTER TABLE suno_credits ADD COLUMN used_credits INTEGER DEFAULT 0;
  END IF;
  
  -- Adicionar remaining_credits se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'suno_credits' 
    AND column_name = 'remaining_credits'
  ) THEN
    ALTER TABLE suno_credits ADD COLUMN remaining_credits INTEGER DEFAULT 0;
  END IF;
  
  -- Adicionar last_updated se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'suno_credits' 
    AND column_name = 'last_updated'
  ) THEN
    ALTER TABLE suno_credits ADD COLUMN last_updated TIMESTAMPTZ DEFAULT NOW();
  END IF;
  
  -- Adicionar last_updated_at se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'suno_credits' 
    AND column_name = 'last_updated_at'
  ) THEN
    ALTER TABLE suno_credits ADD COLUMN last_updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Inserir registro inicial se não existir
-- Agora que garantimos que todas as colunas existem, podemos usar INSERT simples
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
-- 5. GARANTIR TABELA COLLABORATOR_PERMISSIONS
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

-- Políticas (criar apenas se não existirem)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'collaborator_permissions' 
    AND policyname = 'Users can view their own permissions'
  ) THEN
    CREATE POLICY "Users can view their own permissions"
    ON collaborator_permissions FOR SELECT
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'collaborator_permissions' 
    AND policyname = 'Admins can view all permissions'
  ) THEN
    CREATE POLICY "Admins can view all permissions"
    ON collaborator_permissions FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'collaborator_permissions' 
    AND policyname = 'Admins can insert permissions'
  ) THEN
    CREATE POLICY "Admins can insert permissions"
    ON collaborator_permissions FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'collaborator_permissions' 
    AND policyname = 'Admins can update permissions'
  ) THEN
    CREATE POLICY "Admins can update permissions"
    ON collaborator_permissions FOR UPDATE
    USING (
      EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'collaborator_permissions' 
    AND policyname = 'Admins can delete permissions'
  ) THEN
    CREATE POLICY "Admins can delete permissions"
    ON collaborator_permissions FOR DELETE
    USING (
      EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
      )
    );
  END IF;
END $$;

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_collaborator_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 5. ADICIONAR CAMPOS FALTANTES NA TABELA SONGS
-- ============================================================
DO $$
BEGIN
  -- Verificar se a tabela songs existe antes de adicionar campos
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'songs') THEN
    -- Adicionar released_at se não existir
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'songs' 
      AND column_name = 'released_at'
    ) THEN
      ALTER TABLE songs ADD COLUMN released_at TIMESTAMPTZ;
      RAISE NOTICE 'Campo released_at adicionado à tabela songs';
    END IF;

    -- Adicionar variant_number se não existir
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'songs' 
      AND column_name = 'variant_number'
    ) THEN
      ALTER TABLE songs ADD COLUMN variant_number INTEGER DEFAULT 1;
      RAISE NOTICE 'Campo variant_number adicionado à tabela songs';
    END IF;

    -- Adicionar cover_url se não existir
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'songs' 
      AND column_name = 'cover_url'
    ) THEN
      ALTER TABLE songs ADD COLUMN cover_url TEXT;
      RAISE NOTICE 'Campo cover_url adicionado à tabela songs';
    END IF;

    -- Adicionar lyrics se não existir
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'songs' 
      AND column_name = 'lyrics'
    ) THEN
      ALTER TABLE songs ADD COLUMN lyrics TEXT;
      RAISE NOTICE 'Campo lyrics adicionado à tabela songs';
    END IF;

    -- Adicionar release_at se não existir (diferente de released_at)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'songs' 
      AND column_name = 'release_at'
    ) THEN
      ALTER TABLE songs ADD COLUMN release_at TIMESTAMPTZ;
      RAISE NOTICE 'Campo release_at adicionado à tabela songs';
    END IF;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trigger_update_collaborator_permissions_updated_at ON collaborator_permissions;
CREATE TRIGGER trigger_update_collaborator_permissions_updated_at
  BEFORE UPDATE ON collaborator_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_collaborator_permissions_updated_at();

-- ============================================================
-- 6. CRIAR TABELA LYRICS_APPROVALS SE NÃO EXISTIR
-- ============================================================
-- Criar tabela lyrics_approvals sem foreign keys primeiro (para evitar erros se tabelas relacionadas não existirem)
CREATE TABLE IF NOT EXISTS lyrics_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID,
  job_id UUID,
  quiz_id UUID,
  
  -- Conteúdo
  lyrics JSONB,
  lyrics_preview TEXT,
  
  -- Aprovação
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  approval_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '72 hours',
  
  -- Feedback e regenerações
  rejection_reason TEXT,
  regeneration_count INTEGER DEFAULT 0,
  regeneration_feedback TEXT,
  
  -- Ações
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  approved_by TEXT, -- 'customer', 'admin', 'auto'
  
  -- Campos adicionais
  voice TEXT CHECK (voice IN ('M', 'F', 'S')),
  is_highlighted BOOLEAN DEFAULT false,
  reviewing_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewing_at TIMESTAMPTZ,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adicionar colunas faltantes se a tabela já existir
DO $$
BEGIN
  -- Adicionar voice se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'lyrics_approvals' 
    AND column_name = 'voice'
  ) THEN
    ALTER TABLE lyrics_approvals ADD COLUMN voice TEXT CHECK (voice IN ('M', 'F', 'S'));
  END IF;
  
  -- Adicionar is_highlighted se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'lyrics_approvals' 
    AND column_name = 'is_highlighted'
  ) THEN
    ALTER TABLE lyrics_approvals ADD COLUMN is_highlighted BOOLEAN DEFAULT false;
  END IF;
  
  -- Adicionar reviewing_by se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'lyrics_approvals' 
    AND column_name = 'reviewing_by'
  ) THEN
    ALTER TABLE lyrics_approvals ADD COLUMN reviewing_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
  
  -- Adicionar reviewing_at se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'lyrics_approvals' 
    AND column_name = 'reviewing_at'
  ) THEN
    ALTER TABLE lyrics_approvals ADD COLUMN reviewing_at TIMESTAMPTZ;
  END IF;
END $$;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_lyrics_approvals_order_id ON lyrics_approvals(order_id);
CREATE INDEX IF NOT EXISTS idx_lyrics_approvals_job_id ON lyrics_approvals(job_id);
CREATE INDEX IF NOT EXISTS idx_lyrics_approvals_quiz_id ON lyrics_approvals(quiz_id);
CREATE INDEX IF NOT EXISTS idx_lyrics_approvals_status ON lyrics_approvals(status);
CREATE INDEX IF NOT EXISTS idx_lyrics_approvals_token ON lyrics_approvals(approval_token);
CREATE INDEX IF NOT EXISTS idx_lyrics_approvals_expires_at ON lyrics_approvals(expires_at);
CREATE INDEX IF NOT EXISTS idx_lyrics_approvals_voice ON lyrics_approvals(voice);
CREATE INDEX IF NOT EXISTS idx_lyrics_approvals_is_highlighted ON lyrics_approvals(is_highlighted) WHERE is_highlighted = true;
CREATE INDEX IF NOT EXISTS idx_lyrics_approvals_reviewing_by ON lyrics_approvals(reviewing_by);

-- RLS para lyrics_approvals
ALTER TABLE lyrics_approvals ENABLE ROW LEVEL SECURITY;

-- Adicionar foreign keys apenas se as tabelas relacionadas existirem
DO $$
BEGIN
  -- Adicionar foreign key para orders se a tabela existir
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'lyrics_approvals_order_id_fkey' 
      AND table_name = 'lyrics_approvals'
    ) THEN
      ALTER TABLE lyrics_approvals 
      ADD CONSTRAINT lyrics_approvals_order_id_fkey 
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
    END IF;
  END IF;
  
  -- Adicionar foreign key para jobs se a tabela existir
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'jobs') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'lyrics_approvals_job_id_fkey' 
      AND table_name = 'lyrics_approvals'
    ) THEN
      ALTER TABLE lyrics_approvals 
      ADD CONSTRAINT lyrics_approvals_job_id_fkey 
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;
    END IF;
  END IF;
  
  -- Adicionar foreign key para quizzes se a tabela existir
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'quizzes') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'lyrics_approvals_quiz_id_fkey' 
      AND table_name = 'lyrics_approvals'
    ) THEN
      ALTER TABLE lyrics_approvals 
      ADD CONSTRAINT lyrics_approvals_quiz_id_fkey 
      FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- Políticas RLS (criar apenas se não existirem)
DO $$
BEGIN
  -- Política permissiva para SELECT (todos podem ler)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'lyrics_approvals' 
    AND policyname = 'Allow all to read lyrics approvals'
  ) THEN
    CREATE POLICY "Allow all to read lyrics approvals"
    ON lyrics_approvals FOR SELECT
    USING (true);
  END IF;

  -- Política permissiva para INSERT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'lyrics_approvals' 
    AND policyname = 'Allow all to insert lyrics approvals'
  ) THEN
    CREATE POLICY "Allow all to insert lyrics approvals"
    ON lyrics_approvals FOR INSERT
    WITH CHECK (true);
  END IF;

  -- Política permissiva para UPDATE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'lyrics_approvals' 
    AND policyname = 'Allow all to update lyrics approvals'
  ) THEN
    CREATE POLICY "Allow all to update lyrics approvals"
    ON lyrics_approvals FOR UPDATE
    USING (true)
    WITH CHECK (true);
  END IF;

  -- Política permissiva para DELETE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'lyrics_approvals' 
    AND policyname = 'Allow all to delete lyrics approvals'
  ) THEN
    CREATE POLICY "Allow all to delete lyrics approvals"
    ON lyrics_approvals FOR DELETE
    USING (true);
  END IF;
END $$;

-- ============================================================
-- 7. GARANTIR RLS ADEQUADO PARA ORDERS
-- ============================================================
-- Verificar se RLS está habilitado
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Criar política permissiva se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'orders' 
    AND policyname = 'Allow all operations on orders'
  ) THEN
    CREATE POLICY "Allow all operations on orders" 
    ON orders 
    FOR ALL 
    USING (true) 
    WITH CHECK (true);
    
    RAISE NOTICE 'Política RLS criada para orders';
  END IF;
END $$;

-- ============================================================
-- 7. CRIAR ÍNDICES ADICIONAIS PARA PERFORMANCE
-- ============================================================
-- Índices para orders (se não existirem)
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_paid_at ON orders(paid_at) WHERE paid_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_payment_provider ON orders(payment_provider) WHERE payment_provider IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_provider ON orders(provider) WHERE provider IS NOT NULL;

-- ============================================================
-- 8. VERIFICAÇÃO FINAL
-- ============================================================
DO $$
DECLARE
  jobs_exists BOOLEAN;
  suno_credits_exists BOOLEAN;
  collaborator_permissions_exists BOOLEAN;
  lyrics_approvals_exists BOOLEAN;
  orders_has_amount_cents BOOLEAN;
  orders_has_payment_provider BOOLEAN;
  orders_has_provider BOOLEAN;
  orders_has_paid_at BOOLEAN;
BEGIN
  -- Verificar tabelas
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
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'lyrics_approvals'
  ) INTO lyrics_approvals_exists;
  
  -- Verificar campos em orders
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'amount_cents'
  ) INTO orders_has_amount_cents;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'payment_provider'
  ) INTO orders_has_payment_provider;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'provider'
  ) INTO orders_has_provider;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'paid_at'
  ) INTO orders_has_paid_at;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '📊 VERIFICAÇÃO DA ESTRUTURA DO BANCO:';
  RAISE NOTICE '========================================';
  RAISE NOTICE '   Tabela jobs: %', CASE WHEN jobs_exists THEN '✅' ELSE '❌' END;
  RAISE NOTICE '   Tabela suno_credits: %', CASE WHEN suno_credits_exists THEN '✅' ELSE '❌' END;
  RAISE NOTICE '   Tabela collaborator_permissions: %', CASE WHEN collaborator_permissions_exists THEN '✅' ELSE '❌' END;
  RAISE NOTICE '   Tabela lyrics_approvals: %', CASE WHEN lyrics_approvals_exists THEN '✅' ELSE '❌' END;
  RAISE NOTICE '   Campo orders.amount_cents: %', CASE WHEN orders_has_amount_cents THEN '✅' ELSE '❌' END;
  RAISE NOTICE '   Campo orders.payment_provider: %', CASE WHEN orders_has_payment_provider THEN '✅' ELSE '❌' END;
  RAISE NOTICE '   Campo orders.provider: %', CASE WHEN orders_has_provider THEN '✅' ELSE '❌' END;
  RAISE NOTICE '   Campo orders.paid_at: %', CASE WHEN orders_has_paid_at THEN '✅' ELSE '❌' END;
  RAISE NOTICE '========================================';
END $$;

-- ============================================================
-- 6. CRIAR TABELA daily_financial_summary SE NÃO EXISTIR
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_financial_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  revenue_cents INTEGER NOT NULL DEFAULT 0,
  costs_cents INTEGER NOT NULL DEFAULT 0,
  profit_cents INTEGER NOT NULL DEFAULT 0,
  cakto_sales_cents INTEGER NOT NULL DEFAULT 0,
  pix_sales_cents INTEGER NOT NULL DEFAULT 0,
  adjustments_cents INTEGER NOT NULL DEFAULT 0,
  refunds_cents INTEGER NOT NULL DEFAULT 0,
  fixed_costs_cents INTEGER NOT NULL DEFAULT 0,
  variable_costs_cents INTEGER NOT NULL DEFAULT 0,
  api_costs_cents INTEGER NOT NULL DEFAULT 0,
  traffic_costs_cents INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para busca por data
CREATE INDEX IF NOT EXISTS idx_daily_financial_summary_date ON daily_financial_summary(date);

-- RLS para daily_financial_summary
ALTER TABLE daily_financial_summary ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (criar apenas se não existirem)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'daily_financial_summary' 
    AND policyname = 'Admins can view all financial summaries'
  ) THEN
    CREATE POLICY "Admins can view all financial summaries"
    ON daily_financial_summary FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'daily_financial_summary' 
    AND policyname = 'Admins can insert financial summaries'
  ) THEN
    CREATE POLICY "Admins can insert financial summaries"
    ON daily_financial_summary FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'daily_financial_summary' 
    AND policyname = 'Admins can update financial summaries'
  ) THEN
    CREATE POLICY "Admins can update financial summaries"
    ON daily_financial_summary FOR UPDATE
    USING (
      EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'daily_financial_summary' 
    AND policyname = 'Admins can delete financial summaries'
  ) THEN
    CREATE POLICY "Admins can delete financial summaries"
    ON daily_financial_summary FOR DELETE
    USING (
      EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
      )
    );
  END IF;
END $$;

-- ============================================================
-- 7. CRIAR ENUMS FINANCEIROS SE NÃO EXISTIREM
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'financial_category_type') THEN
    CREATE TYPE financial_category_type AS ENUM (
      'fixed_cost', 
      'variable_cost', 
      'revenue', 
      'marketing', 
      'operational', 
      'api_cost'
    );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cost_frequency') THEN
    CREATE TYPE cost_frequency AS ENUM (
      'monthly', 
      'yearly', 
      'weekly', 
      'daily'
    );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'refund_status') THEN
    CREATE TYPE refund_status AS ENUM (
      'pending', 
      'completed', 
      'failed'
    );
  END IF;
END $$;

-- ============================================================
-- 8. CRIAR TABELAS FINANCEIRAS SE NÃO EXISTIREM
-- ============================================================

-- Tabela financial_categories
CREATE TABLE IF NOT EXISTS financial_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type financial_category_type NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela fixed_costs
CREATE TABLE IF NOT EXISTS fixed_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES financial_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  frequency cost_frequency NOT NULL DEFAULT 'monthly',
  month INTEGER CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela variable_costs
CREATE TABLE IF NOT EXISTS variable_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES financial_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  receipt_url TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela api_costs
CREATE TABLE IF NOT EXISTS api_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  credits_used INTEGER,
  date DATE NOT NULL,
  description TEXT,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela cakto_sales_summary
CREATE TABLE IF NOT EXISTS cakto_sales_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  quantity INTEGER NOT NULL DEFAULT 0,
  product_value_cents INTEGER NOT NULL,
  fee_cents INTEGER NOT NULL,
  total_sales_cents INTEGER NOT NULL GENERATED ALWAYS AS (product_value_cents * quantity) STORED,
  total_fees_cents INTEGER NOT NULL GENERATED ALWAYS AS (fee_cents * quantity) STORED,
  net_revenue_cents INTEGER NOT NULL GENERATED ALWAYS AS ((product_value_cents - fee_cents) * quantity) STORED,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para tabelas financeiras
CREATE INDEX IF NOT EXISTS idx_fixed_costs_month_year ON fixed_costs(year, month);
CREATE INDEX IF NOT EXISTS idx_fixed_costs_category ON fixed_costs(category_id);
CREATE INDEX IF NOT EXISTS idx_variable_costs_date ON variable_costs(date);
CREATE INDEX IF NOT EXISTS idx_variable_costs_category ON variable_costs(category_id);
CREATE INDEX IF NOT EXISTS idx_api_costs_date ON api_costs(date);
CREATE INDEX IF NOT EXISTS idx_api_costs_provider ON api_costs(provider);
CREATE INDEX IF NOT EXISTS idx_cakto_sales_summary_date ON cakto_sales_summary(date);

-- RLS para tabelas financeiras
ALTER TABLE financial_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE variable_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cakto_sales_summary ENABLE ROW LEVEL SECURITY;

-- Políticas RLS básicas (apenas para admins)
DO $$
BEGIN
  -- financial_categories
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'financial_categories' AND policyname = 'Admins can manage financial categories') THEN
    CREATE POLICY "Admins can manage financial categories" ON financial_categories FOR ALL
    USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));
  END IF;
  
  -- fixed_costs
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'fixed_costs' AND policyname = 'Admins can manage fixed costs') THEN
    CREATE POLICY "Admins can manage fixed costs" ON fixed_costs FOR ALL
    USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));
  END IF;
  
  -- variable_costs
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'variable_costs' AND policyname = 'Admins can manage variable costs') THEN
    CREATE POLICY "Admins can manage variable costs" ON variable_costs FOR ALL
    USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));
  END IF;
  
  -- api_costs
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'api_costs' AND policyname = 'Admins can manage api costs') THEN
    CREATE POLICY "Admins can manage api costs" ON api_costs FOR ALL
    USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));
  END IF;
  
  -- cakto_sales_summary
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cakto_sales_summary' AND policyname = 'Admins can manage cakto sales') THEN
    CREATE POLICY "Admins can manage cakto sales" ON cakto_sales_summary FOR ALL
    USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));
  END IF;
END $$;

-- ============================================================
-- 9. CRIAR TABELA email_logs SE NÃO EXISTIR
-- ============================================================
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID,
  song_id UUID,
  email_type TEXT NOT NULL CHECK (email_type IN ('order_paid', 'music_released', 'order_failed', 'test_complete', 'welcome', 'low_credits', 'payment_confirmed')),
  recipient_email TEXT NOT NULL,
  resend_email_id TEXT,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'pending', 'failed')),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  bounce_reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  template_used TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adicionar foreign keys apenas se as tabelas relacionadas existirem
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'email_logs_order_id_fkey' AND table_name = 'email_logs') THEN
      ALTER TABLE email_logs ADD CONSTRAINT email_logs_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
    END IF;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'songs') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'email_logs_song_id_fkey' AND table_name = 'email_logs') THEN
      ALTER TABLE email_logs ADD CONSTRAINT email_logs_song_id_fkey FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- Índices para email_logs
CREATE INDEX IF NOT EXISTS idx_email_logs_order_id ON email_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_song_id ON email_logs(song_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_email_type ON email_logs(email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at);

-- RLS para email_logs
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (criar apenas se não existirem)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'email_logs' 
    AND policyname = 'Admins can view all email logs'
  ) THEN
    CREATE POLICY "Admins can view all email logs"
    ON email_logs FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'email_logs' 
    AND policyname = 'Service role can manage email logs'
  ) THEN
    CREATE POLICY "Service role can manage email logs"
    ON email_logs FOR ALL
    USING (auth.role() = 'service_role');
  END IF;
END $$;

-- ============================================================
-- 10. CRIAR TABELA checkout_events SE NÃO EXISTIR
-- ============================================================
CREATE TABLE IF NOT EXISTS checkout_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID,
  order_id UUID,
  event_type TEXT NOT NULL,
  payload JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adicionar foreign key apenas se a tabela orders existir
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'checkout_events_order_id_fkey' AND table_name = 'checkout_events') THEN
      ALTER TABLE checkout_events ADD CONSTRAINT checkout_events_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- Índices para checkout_events
CREATE INDEX IF NOT EXISTS idx_checkout_events_transaction_id ON checkout_events(transaction_id);
CREATE INDEX IF NOT EXISTS idx_checkout_events_order_id ON checkout_events(order_id);
CREATE INDEX IF NOT EXISTS idx_checkout_events_type ON checkout_events(event_type);
CREATE INDEX IF NOT EXISTS idx_checkout_events_created_at ON checkout_events(created_at DESC);

-- RLS para checkout_events
ALTER TABLE checkout_events ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (criar apenas se não existirem)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'checkout_events' 
    AND policyname = 'Admins can view checkout events'
  ) THEN
    CREATE POLICY "Admins can view checkout events"
    ON checkout_events FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'checkout_events' 
    AND policyname = 'Service role can manage checkout events'
  ) THEN
    CREATE POLICY "Service role can manage checkout events"
    ON checkout_events FOR ALL
    USING (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'checkout_events' 
    AND policyname = 'Authenticated users can insert checkout events'
  ) THEN
    CREATE POLICY "Authenticated users can insert checkout events"
    ON checkout_events FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

-- Função RPC para limpeza de checkout_events antigos
CREATE OR REPLACE FUNCTION cleanup_old_checkout_events()
RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Deletar eventos mais antigos que 30 dias
  DELETE FROM checkout_events
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;

