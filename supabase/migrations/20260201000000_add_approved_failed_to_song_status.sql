-- ==========================================
-- ADICIONAR 'approved' E 'failed' AO ENUM song_status
-- Corrige erro 400 em AdminSongs ao filtrar por status=in.(approved,released)
-- O enum original tinha apenas: pending, ready, released
-- ==========================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'song_status') THEN
    ALTER TYPE song_status ADD VALUE IF NOT EXISTS 'approved';
    ALTER TYPE song_status ADD VALUE IF NOT EXISTS 'failed';
  END IF;
END $$;
