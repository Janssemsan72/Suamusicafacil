-- Adicionar campo is_highlighted na tabela lyrics_approvals
ALTER TABLE public.lyrics_approvals 
ADD COLUMN IF NOT EXISTS is_highlighted BOOLEAN DEFAULT false;

-- Criar índice para performance em consultas filtradas por is_highlighted
CREATE INDEX IF NOT EXISTS idx_lyrics_approvals_is_highlighted 
ON public.lyrics_approvals(is_highlighted) 
WHERE is_highlighted = true;

-- Comentário explicativo
COMMENT ON COLUMN public.lyrics_approvals.is_highlighted IS 'Indica se a letra está destacada pelo admin';

