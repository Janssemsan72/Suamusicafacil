-- ==========================================
-- ADICIONAR CAMPOS DE RASTREAMENTO DE VERIFICAÇÃO
-- Campos para rastrear qual admin está verificando uma letra
-- ==========================================

-- Adicionar campos de rastreamento de verificação
ALTER TABLE public.lyrics_approvals
ADD COLUMN IF NOT EXISTS reviewing_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reviewing_at TIMESTAMPTZ;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_lyrics_approvals_reviewing_by ON public.lyrics_approvals(reviewing_by);

-- Comentários para documentação
COMMENT ON COLUMN public.lyrics_approvals.reviewing_by IS 'ID do usuário admin que está verificando esta letra';
COMMENT ON COLUMN public.lyrics_approvals.reviewing_at IS 'Data/hora em que o admin começou a verificar esta letra';


