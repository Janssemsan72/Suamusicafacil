-- ==========================================
-- CRIAÇÃO DA TABELA DE RASTREAMENTO DE CRÉDITOS SUNO
-- ==========================================

-- Tabela para rastrear créditos do Suno
CREATE TABLE IF NOT EXISTS public.suno_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_credits INTEGER NOT NULL DEFAULT 92750,
  used_credits INTEGER NOT NULL DEFAULT 0,
  remaining_credits INTEGER NOT NULL DEFAULT 92750,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela para histórico de uso de créditos
CREATE TABLE IF NOT EXISTS public.suno_credits_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credits_used INTEGER NOT NULL,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir registro inicial se não existir
INSERT INTO public.suno_credits (id, total_credits, used_credits, remaining_credits)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  92750,
  0,
  92750
)
ON CONFLICT (id) DO NOTHING;

-- Função para descontar créditos (com lock para evitar race conditions)
CREATE OR REPLACE FUNCTION public.deduct_suno_credits(
  credits_to_deduct INTEGER,
  p_job_id UUID DEFAULT NULL,
  p_order_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  credit_record RECORD;
  current_credits INTEGER;
  current_used INTEGER;
  new_remaining INTEGER;
  result JSONB;
  credit_id UUID;
BEGIN
  -- Garantir que existe um registro (usar ID fixo)
  credit_id := '00000000-0000-0000-0000-000000000001';
  
  -- Buscar créditos atuais com FOR UPDATE para evitar race conditions
  SELECT id, remaining_credits, used_credits INTO credit_record
  FROM public.suno_credits
  WHERE id = credit_id
  FOR UPDATE; -- Lock para evitar concorrência

  -- Se não houver registro, criar um
  IF credit_record.id IS NULL THEN
    INSERT INTO public.suno_credits (id, total_credits, used_credits, remaining_credits)
    VALUES (credit_id, 92750, 0, 92750)
    ON CONFLICT (id) DO UPDATE SET
      remaining_credits = EXCLUDED.remaining_credits,
      used_credits = EXCLUDED.used_credits
    RETURNING remaining_credits, used_credits INTO current_credits, current_used;
  ELSE
    current_credits := credit_record.remaining_credits;
    current_used := credit_record.used_credits;
  END IF;

  -- Validar que temos créditos suficientes
  IF current_credits IS NULL OR current_credits < 0 THEN
    current_credits := 0;
  END IF;

  -- Calcular novos valores (SUBTRAIR os créditos)
  new_remaining := current_credits - credits_to_deduct;

  -- Garantir que não fique negativo
  IF new_remaining < 0 THEN
    new_remaining := 0;
  END IF;

  -- Atualizar créditos (SOMAR aos usados, SUBTRAIR dos restantes)
  UPDATE public.suno_credits
  SET 
    used_credits = COALESCE(current_used, 0) + credits_to_deduct,
    remaining_credits = new_remaining,
    last_updated = NOW(),
    updated_at = NOW()
  WHERE id = credit_id;

  -- Verificar se a atualização foi bem-sucedida
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Erro ao atualizar créditos: registro não encontrado';
  END IF;

  -- Registrar no histórico
  INSERT INTO public.suno_credits_history (credits_used, job_id, order_id, description)
  VALUES (credits_to_deduct, p_job_id, p_order_id, p_description);

  -- Retornar resultado com informações detalhadas
  SELECT jsonb_build_object(
    'success', true,
    'credits_deducted', credits_to_deduct,
    'remaining_credits', new_remaining,
    'previous_credits', current_credits,
    'used_credits', COALESCE(current_used, 0) + credits_to_deduct
  ) INTO result;

  RETURN result;
END;
$$;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_suno_credits_history_created_at 
ON public.suno_credits_history(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_suno_credits_history_job_id 
ON public.suno_credits_history(job_id);

CREATE INDEX IF NOT EXISTS idx_suno_credits_history_order_id 
ON public.suno_credits_history(order_id);

-- Comentários
COMMENT ON TABLE public.suno_credits IS 'Rastreamento de créditos do Suno API';
COMMENT ON TABLE public.suno_credits_history IS 'Histórico de uso de créditos do Suno';
COMMENT ON FUNCTION public.deduct_suno_credits IS 'Desconta créditos do Suno e registra no histórico';

