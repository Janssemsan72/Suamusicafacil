-- Adicionar campo voice na tabela lyrics_approvals
-- M = Masculino, F = Feminino, S = Sem preferência

ALTER TABLE public.lyrics_approvals 
ADD COLUMN IF NOT EXISTS voice TEXT CHECK (voice IN ('M', 'F', 'S'));

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_lyrics_approvals_voice ON public.lyrics_approvals(voice);

-- Comentário explicativo
COMMENT ON COLUMN public.lyrics_approvals.voice IS 'Voz da música: M (Masculino), F (Feminino), S (Sem preferência)';

