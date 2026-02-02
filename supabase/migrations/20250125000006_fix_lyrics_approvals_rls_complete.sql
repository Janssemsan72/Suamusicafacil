-- Migração completa para corrigir todas as políticas RLS da tabela lyrics_approvals
-- Esta migração garante que todas as operações funcionem corretamente

-- Primeiro, vamos remover todas as políticas existentes para recriar
DROP POLICY IF EXISTS "Admins can view all lyrics approvals" ON public.lyrics_approvals;
DROP POLICY IF EXISTS "Admins can update lyrics approvals" ON public.lyrics_approvals;
DROP POLICY IF EXISTS "Admins can delete lyrics approvals" ON public.lyrics_approvals;
DROP POLICY IF EXISTS "Service role can insert lyrics approvals" ON public.lyrics_approvals;
DROP POLICY IF EXISTS "Service role can update lyrics approvals" ON public.lyrics_approvals;
DROP POLICY IF EXISTS "Service role can delete lyrics approvals" ON public.lyrics_approvals;
DROP POLICY IF EXISTS "Customers can view their own lyrics approvals" ON public.lyrics_approvals;

-- Criar a tabela se não existir (com estrutura completa)
CREATE TABLE IF NOT EXISTS public.lyrics_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  
  -- Conteúdo
  lyrics JSONB NOT NULL,
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
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.lyrics_approvals ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- POLÍTICAS RLS COMPLETAS
-- ===========================================

-- 1. SELECT - Admins podem ver todas as aprovações
CREATE POLICY "Admins can view all lyrics approvals"
  ON public.lyrics_approvals
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. SELECT - Clientes podem ver suas próprias aprovações
CREATE POLICY "Customers can view their own lyrics approvals"
  ON public.lyrics_approvals
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders 
      WHERE orders.id = lyrics_approvals.order_id 
      AND orders.customer_email = auth.jwt() ->> 'email'
    )
  );

-- 3. INSERT - Service role pode inserir aprovações
CREATE POLICY "Service role can insert lyrics approvals"
  ON public.lyrics_approvals
  FOR INSERT
  WITH CHECK (true);

-- 4. UPDATE - Admins podem atualizar aprovações
CREATE POLICY "Admins can update lyrics approvals"
  ON public.lyrics_approvals
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 5. UPDATE - Service role pode atualizar aprovações
CREATE POLICY "Service role can update lyrics approvals"
  ON public.lyrics_approvals
  FOR UPDATE
  USING (true);

-- 6. DELETE - Admins podem deletar aprovações
CREATE POLICY "Admins can delete lyrics approvals"
  ON public.lyrics_approvals
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 7. DELETE - Service role pode deletar aprovações
CREATE POLICY "Service role can delete lyrics approvals"
  ON public.lyrics_approvals
  FOR DELETE
  USING (true);

-- ===========================================
-- ÍNDICES PARA PERFORMANCE
-- ===========================================

-- Índices para performance (criar apenas se não existirem)
CREATE INDEX IF NOT EXISTS idx_lyrics_approvals_order_id ON public.lyrics_approvals(order_id);
CREATE INDEX IF NOT EXISTS idx_lyrics_approvals_status ON public.lyrics_approvals(status);
CREATE INDEX IF NOT EXISTS idx_lyrics_approvals_token ON public.lyrics_approvals(approval_token);
CREATE INDEX IF NOT EXISTS idx_lyrics_approvals_expires_at ON public.lyrics_approvals(expires_at);
CREATE INDEX IF NOT EXISTS idx_lyrics_approvals_created_at ON public.lyrics_approvals(created_at);

-- ===========================================
-- TRIGGERS PARA AUDIT
-- ===========================================

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_lyrics_approvals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_lyrics_approvals_updated_at ON public.lyrics_approvals;
CREATE TRIGGER trigger_update_lyrics_approvals_updated_at
  BEFORE UPDATE ON public.lyrics_approvals
  FOR EACH ROW
  EXECUTE FUNCTION update_lyrics_approvals_updated_at();

-- ===========================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ===========================================

COMMENT ON TABLE public.lyrics_approvals IS 'Tabela para gerenciar aprovações de letras de músicas';
COMMENT ON COLUMN public.lyrics_approvals.lyrics IS 'Conteúdo das letras em formato JSON';
COMMENT ON COLUMN public.lyrics_approvals.status IS 'Status da aprovação: pending, approved, rejected, expired';
COMMENT ON COLUMN public.lyrics_approvals.approval_token IS 'Token único para aprovação via email';
COMMENT ON COLUMN public.lyrics_approvals.regeneration_count IS 'Número de regenerações realizadas';
COMMENT ON COLUMN public.lyrics_approvals.approved_by IS 'Quem aprovou: customer, admin, auto';
