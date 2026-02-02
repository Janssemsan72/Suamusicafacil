-- ============================================================
-- MIGRATION: Sistema Profissional de Feedbacks e Vídeos de Reação
-- Data: 2025-01-27
-- ============================================================

-- ============================================================
-- 1. CRIAR ENUMS
-- ============================================================

-- Verificar e criar enums apenas se não existirem
DO $$
BEGIN
  -- feedback_type
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'feedback_type') THEN
    CREATE TYPE feedback_type AS ENUM ('general', 'song_review', 'service_review', 'suggestion', 'complaint');
  END IF;

  -- feedback_status
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'feedback_status') THEN
    CREATE TYPE feedback_status AS ENUM ('pending', 'approved', 'rejected', 'featured');
  END IF;

  -- video_status (já pode existir, mas vamos garantir)
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'video_status') THEN
    CREATE TYPE video_status AS ENUM ('pending', 'approved', 'rejected', 'featured');
  END IF;

  -- gift_card_status (já pode existir, mas vamos garantir)
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gift_card_status') THEN
    CREATE TYPE gift_card_status AS ENUM ('sent', 'redeemed', 'expired', 'cancelled');
  END IF;

  -- moderation_action
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'moderation_action') THEN
    CREATE TYPE moderation_action AS ENUM ('approve', 'reject', 'feature', 'unfeature', 'delete');
  END IF;

  -- content_type
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'content_type') THEN
    CREATE TYPE content_type AS ENUM ('feedback', 'video');
  END IF;
END $$;

-- ============================================================
-- 2. CRIAR TABELA customer_feedbacks
-- ============================================================
CREATE TABLE IF NOT EXISTS customer_feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID,
  song_id UUID,
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback_text TEXT NOT NULL,
  feedback_type TEXT NOT NULL DEFAULT 'general' CHECK (feedback_type IN ('general', 'song_review', 'service_review', 'suggestion', 'complaint')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'featured')),
  is_public BOOLEAN DEFAULT false,
  admin_notes TEXT,
  moderated_by UUID,
  moderated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adicionar foreign keys apenas se as tabelas relacionadas existirem
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'customer_feedbacks_order_id_fkey' AND table_name = 'customer_feedbacks') THEN
      ALTER TABLE customer_feedbacks ADD CONSTRAINT customer_feedbacks_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
    END IF;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'songs') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'customer_feedbacks_song_id_fkey' AND table_name = 'customer_feedbacks') THEN
      ALTER TABLE customer_feedbacks ADD CONSTRAINT customer_feedbacks_song_id_fkey FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE;
    END IF;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'auth.users') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'customer_feedbacks_moderated_by_fkey' AND table_name = 'customer_feedbacks') THEN
      ALTER TABLE customer_feedbacks ADD CONSTRAINT customer_feedbacks_moderated_by_fkey FOREIGN KEY (moderated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- Índices para customer_feedbacks
CREATE INDEX IF NOT EXISTS idx_customer_feedbacks_order_id ON customer_feedbacks(order_id);
CREATE INDEX IF NOT EXISTS idx_customer_feedbacks_song_id ON customer_feedbacks(song_id);
CREATE INDEX IF NOT EXISTS idx_customer_feedbacks_status ON customer_feedbacks(status);
CREATE INDEX IF NOT EXISTS idx_customer_feedbacks_feedback_type ON customer_feedbacks(feedback_type);
CREATE INDEX IF NOT EXISTS idx_customer_feedbacks_created_at ON customer_feedbacks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_feedbacks_is_public ON customer_feedbacks(is_public) WHERE is_public = true;

-- ============================================================
-- 3. CRIAR TABELA moderation_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS moderation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moderator_id UUID NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('feedback', 'video')),
  content_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('approve', 'reject', 'feature', 'unfeature', 'delete')),
  previous_status TEXT,
  new_status TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adicionar foreign key apenas se a tabela auth.users existir
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'auth.users') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'moderation_logs_moderator_id_fkey' AND table_name = 'moderation_logs') THEN
      ALTER TABLE moderation_logs ADD CONSTRAINT moderation_logs_moderator_id_fkey FOREIGN KEY (moderator_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- Índices para moderation_logs
CREATE INDEX IF NOT EXISTS idx_moderation_logs_moderator_id ON moderation_logs(moderator_id);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_content_type_content_id ON moderation_logs(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_created_at ON moderation_logs(created_at DESC);

-- ============================================================
-- 4. ATUALIZAR TABELA gift_cards (adicionar customer_feedback_id se não existir)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'gift_cards') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'gift_cards' AND column_name = 'customer_feedback_id') THEN
      ALTER TABLE gift_cards ADD COLUMN customer_feedback_id UUID;
    END IF;
  END IF;
END $$;

-- Adicionar foreign key para customer_feedbacks se a tabela existir
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'gift_cards') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customer_feedbacks') THEN
      IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'gift_cards_customer_feedback_id_fkey' AND table_name = 'gift_cards') THEN
        ALTER TABLE gift_cards ADD CONSTRAINT gift_cards_customer_feedback_id_fkey FOREIGN KEY (customer_feedback_id) REFERENCES customer_feedbacks(id) ON DELETE SET NULL;
      END IF;
    END IF;
  END IF;
END $$;

-- Índice para customer_feedback_id em gift_cards
CREATE INDEX IF NOT EXISTS idx_gift_cards_customer_feedback_id ON gift_cards(customer_feedback_id) WHERE customer_feedback_id IS NOT NULL;

-- ============================================================
-- 5. RLS (Row Level Security)
-- ============================================================

-- RLS para customer_feedbacks
ALTER TABLE customer_feedbacks ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para customer_feedbacks
DO $$
BEGIN
  -- Público pode inserir seus próprios feedbacks
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'customer_feedbacks' 
    AND policyname = 'Public can insert own feedbacks'
  ) THEN
    CREATE POLICY "Public can insert own feedbacks"
    ON customer_feedbacks FOR INSERT
    WITH CHECK (true);
  END IF;

  -- Público pode visualizar feedbacks aprovados e públicos
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'customer_feedbacks' 
    AND policyname = 'Public can view approved or public feedbacks'
  ) THEN
    CREATE POLICY "Public can view approved or public feedbacks"
    ON customer_feedbacks FOR SELECT
    USING (status IN ('approved', 'featured') AND is_public = true);
  END IF;

  -- Admins podem gerenciar todos os feedbacks
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'customer_feedbacks' 
    AND policyname = 'Admins can manage all feedbacks'
  ) THEN
    CREATE POLICY "Admins can manage all feedbacks"
    ON customer_feedbacks FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
      )
    );
  END IF;

  -- Service role pode gerenciar tudo
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'customer_feedbacks' 
    AND policyname = 'Service role can manage all feedbacks'
  ) THEN
    CREATE POLICY "Service role can manage all feedbacks"
    ON customer_feedbacks FOR ALL
    USING (auth.role() = 'service_role');
  END IF;
END $$;

-- RLS para moderation_logs
ALTER TABLE moderation_logs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para moderation_logs
DO $$
BEGIN
  -- Apenas admins podem visualizar logs de moderação
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'moderation_logs' 
    AND policyname = 'Admins can view moderation logs'
  ) THEN
    CREATE POLICY "Admins can view moderation logs"
    ON moderation_logs FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
      )
    );
  END IF;

  -- Admins podem inserir logs de moderação
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'moderation_logs' 
    AND policyname = 'Admins can insert moderation logs'
  ) THEN
    CREATE POLICY "Admins can insert moderation logs"
    ON moderation_logs FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
      )
    );
  END IF;

  -- Service role pode gerenciar tudo
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'moderation_logs' 
    AND policyname = 'Service role can manage all moderation logs'
  ) THEN
    CREATE POLICY "Service role can manage all moderation logs"
    ON moderation_logs FOR ALL
    USING (auth.role() = 'service_role');
  END IF;
END $$;

-- ============================================================
-- 6. FUNÇÕES AUXILIARES
-- ============================================================

-- Trigger para atualizar updated_at em customer_feedbacks
DROP TRIGGER IF EXISTS update_customer_feedbacks_updated_at ON customer_feedbacks;
CREATE TRIGGER update_customer_feedbacks_updated_at
  BEFORE UPDATE ON customer_feedbacks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Função para registrar log de moderação automaticamente
CREATE OR REPLACE FUNCTION log_moderation_action()
RETURNS TRIGGER AS $$
BEGIN
  -- Registrar mudança de status
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO moderation_logs (
      moderator_id,
      content_type,
      content_id,
      action,
      previous_status,
      new_status
    ) VALUES (
      NEW.moderated_by,
      'feedback',
      NEW.id,
      CASE 
        WHEN NEW.status = 'approved' THEN 'approve'
        WHEN NEW.status = 'rejected' THEN 'reject'
        WHEN NEW.status = 'featured' THEN 'feature'
        ELSE 'approve'
      END,
      OLD.status,
      NEW.status
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para customer_feedbacks
DROP TRIGGER IF EXISTS log_customer_feedback_moderation ON customer_feedbacks;
CREATE TRIGGER log_customer_feedback_moderation
  AFTER UPDATE OF status ON customer_feedbacks
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION log_moderation_action();

-- Função similar para reaction_videos
CREATE OR REPLACE FUNCTION log_video_moderation_action()
RETURNS TRIGGER AS $$
BEGIN
  -- Registrar mudança de status
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO moderation_logs (
      moderator_id,
      content_type,
      content_id,
      action,
      previous_status,
      new_status
    ) VALUES (
      NEW.moderated_by,
      'video',
      NEW.id,
      CASE 
        WHEN NEW.status = 'approved' THEN 'approve'
        WHEN NEW.status = 'rejected' THEN 'reject'
        WHEN NEW.status = 'featured' THEN 'feature'
        ELSE 'approve'
      END,
      OLD.status,
      NEW.status
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para reaction_videos
DROP TRIGGER IF EXISTS log_reaction_video_moderation ON reaction_videos;
CREATE TRIGGER log_reaction_video_moderation
  AFTER UPDATE OF status ON reaction_videos
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION log_video_moderation_action();



















