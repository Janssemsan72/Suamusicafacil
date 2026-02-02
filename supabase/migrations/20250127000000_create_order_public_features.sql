-- ============================================================
-- MIGRATION: Página Pública de Pedido - Player, Downloads, Gorjeta e Vídeos
-- Data: 2025-01-27
-- ============================================================

-- ============================================================
-- 1. CRIAR TABELA reaction_videos
-- ============================================================
CREATE TABLE IF NOT EXISTS reaction_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID,
  song_id UUID,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  uploader_email TEXT NOT NULL,
  uploader_name TEXT,
  video_title TEXT,
  description TEXT,
  duration_seconds INTEGER,
  file_size_bytes BIGINT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'featured')),
  gift_card_sent BOOLEAN DEFAULT false,
  gift_card_code TEXT,
  gift_card_sent_at TIMESTAMPTZ,
  admin_notes TEXT,
  moderated_by UUID,
  moderated_at TIMESTAMPTZ,
  view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adicionar foreign keys apenas se as tabelas relacionadas existirem
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'reaction_videos_order_id_fkey' AND table_name = 'reaction_videos') THEN
      ALTER TABLE reaction_videos ADD CONSTRAINT reaction_videos_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
    END IF;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'songs') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'reaction_videos_song_id_fkey' AND table_name = 'reaction_videos') THEN
      ALTER TABLE reaction_videos ADD CONSTRAINT reaction_videos_song_id_fkey FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE;
    END IF;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'auth.users') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'reaction_videos_moderated_by_fkey' AND table_name = 'reaction_videos') THEN
      ALTER TABLE reaction_videos ADD CONSTRAINT reaction_videos_moderated_by_fkey FOREIGN KEY (moderated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- Índices para reaction_videos
CREATE INDEX IF NOT EXISTS idx_reaction_videos_order_id ON reaction_videos(order_id);
CREATE INDEX IF NOT EXISTS idx_reaction_videos_song_id ON reaction_videos(song_id);
CREATE INDEX IF NOT EXISTS idx_reaction_videos_status ON reaction_videos(status);
CREATE INDEX IF NOT EXISTS idx_reaction_videos_gift_card_sent ON reaction_videos(gift_card_sent);
CREATE INDEX IF NOT EXISTS idx_reaction_videos_created_at ON reaction_videos(created_at DESC);

-- ============================================================
-- 2. CRIAR TABELA tips
-- ============================================================
CREATE TABLE IF NOT EXISTS tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID,
  amount_cents INTEGER NOT NULL,
  donor_email TEXT NOT NULL,
  donor_name TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adicionar foreign key apenas se a tabela orders existir
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'tips_order_id_fkey' AND table_name = 'tips') THEN
      ALTER TABLE tips ADD CONSTRAINT tips_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- Índices para tips
CREATE INDEX IF NOT EXISTS idx_tips_order_id ON tips(order_id);
CREATE INDEX IF NOT EXISTS idx_tips_status ON tips(status);
CREATE INDEX IF NOT EXISTS idx_tips_created_at ON tips(created_at DESC);

-- ============================================================
-- 3. CRIAR TABELA gift_cards
-- ============================================================
CREATE TABLE IF NOT EXISTS gift_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reaction_video_id UUID,
  customer_feedback_id UUID,
  hotmart_voucher_code TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  amount DECIMAL(10,2),
  currency TEXT DEFAULT 'BRL',
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'redeemed', 'expired', 'cancelled')),
  sent_at TIMESTAMPTZ,
  redeemed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  hotmart_response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adicionar foreign keys apenas se as tabelas relacionadas existirem
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reaction_videos') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'gift_cards_reaction_video_id_fkey' AND table_name = 'gift_cards') THEN
      ALTER TABLE gift_cards ADD CONSTRAINT gift_cards_reaction_video_id_fkey FOREIGN KEY (reaction_video_id) REFERENCES reaction_videos(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- Índices para gift_cards
CREATE INDEX IF NOT EXISTS idx_gift_cards_reaction_video_id ON gift_cards(reaction_video_id);
CREATE INDEX IF NOT EXISTS idx_gift_cards_status ON gift_cards(status);
CREATE INDEX IF NOT EXISTS idx_gift_cards_recipient_email ON gift_cards(recipient_email);
CREATE INDEX IF NOT EXISTS idx_gift_cards_sent_at ON gift_cards(sent_at DESC);

-- ============================================================
-- 4. RLS (Row Level Security)
-- ============================================================

-- RLS para reaction_videos
ALTER TABLE reaction_videos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para reaction_videos
DO $$
BEGIN
  -- Público pode inserir seus próprios vídeos
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'reaction_videos' 
    AND policyname = 'Public can insert own videos'
  ) THEN
    CREATE POLICY "Public can insert own videos"
    ON reaction_videos FOR INSERT
    WITH CHECK (true);
  END IF;

  -- Público pode visualizar vídeos aprovados ou seus próprios
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'reaction_videos' 
    AND policyname = 'Public can view approved or own videos'
  ) THEN
    CREATE POLICY "Public can view approved or own videos"
    ON reaction_videos FOR SELECT
    USING (status IN ('approved', 'featured'));
  END IF;

  -- Admins podem gerenciar todos os vídeos
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'reaction_videos' 
    AND policyname = 'Admins can manage all videos'
  ) THEN
    CREATE POLICY "Admins can manage all videos"
    ON reaction_videos FOR ALL
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
    AND tablename = 'reaction_videos' 
    AND policyname = 'Service role can manage all videos'
  ) THEN
    CREATE POLICY "Service role can manage all videos"
    ON reaction_videos FOR ALL
    USING (auth.role() = 'service_role');
  END IF;
END $$;

-- RLS para tips
ALTER TABLE tips ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para tips
DO $$
BEGIN
  -- Público pode inserir gorjetas
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'tips' 
    AND policyname = 'Public can insert tips'
  ) THEN
    CREATE POLICY "Public can insert tips"
    ON tips FOR INSERT
    WITH CHECK (true);
  END IF;

  -- Admins podem visualizar todas as gorjetas
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'tips' 
    AND policyname = 'Admins can view all tips'
  ) THEN
    CREATE POLICY "Admins can view all tips"
    ON tips FOR SELECT
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
    AND tablename = 'tips' 
    AND policyname = 'Service role can manage all tips'
  ) THEN
    CREATE POLICY "Service role can manage all tips"
    ON tips FOR ALL
    USING (auth.role() = 'service_role');
  END IF;
END $$;

-- RLS para gift_cards
ALTER TABLE gift_cards ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para gift_cards
DO $$
BEGIN
  -- Apenas admins podem visualizar gift cards
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'gift_cards' 
    AND policyname = 'Admins can view all gift cards'
  ) THEN
    CREATE POLICY "Admins can view all gift cards"
    ON gift_cards FOR SELECT
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
    AND tablename = 'gift_cards' 
    AND policyname = 'Service role can manage all gift cards'
  ) THEN
    CREATE POLICY "Service role can manage all gift cards"
    ON gift_cards FOR ALL
    USING (auth.role() = 'service_role');
  END IF;
END $$;

-- ============================================================
-- 5. FUNÇÕES AUXILIARES
-- ============================================================

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
DROP TRIGGER IF EXISTS update_reaction_videos_updated_at ON reaction_videos;
CREATE TRIGGER update_reaction_videos_updated_at
  BEFORE UPDATE ON reaction_videos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tips_updated_at ON tips;
CREATE TRIGGER update_tips_updated_at
  BEFORE UPDATE ON tips
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_gift_cards_updated_at ON gift_cards;
CREATE TRIGGER update_gift_cards_updated_at
  BEFORE UPDATE ON gift_cards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

