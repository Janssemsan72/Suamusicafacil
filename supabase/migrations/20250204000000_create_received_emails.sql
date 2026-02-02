-- ==========================================
-- TABELA received_emails - Emails Recebidos via Resend Inbound
-- Armazena emails recebidos em contato@musiclovely.com
-- ==========================================

CREATE TABLE IF NOT EXISTS public.received_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resend_email_id TEXT UNIQUE,
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_email TEXT NOT NULL,
  subject TEXT,
  html_content TEXT,
  text_content TEXT,
  headers JSONB DEFAULT '{}'::jsonb,
  attachments JSONB DEFAULT '[]'::jsonb,
  thread_id TEXT,
  in_reply_to TEXT,
  is_read BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  replied_at TIMESTAMPTZ,
  replied_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_received_emails_from_email ON public.received_emails(from_email);
CREATE INDEX IF NOT EXISTS idx_received_emails_created_at ON public.received_emails(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_received_emails_is_read ON public.received_emails(is_read);
CREATE INDEX IF NOT EXISTS idx_received_emails_thread_id ON public.received_emails(thread_id);
CREATE INDEX IF NOT EXISTS idx_received_emails_is_archived ON public.received_emails(is_archived);

-- Comentários
COMMENT ON TABLE public.received_emails IS 'Emails recebidos via Resend Inbound em contato@musiclovely.com';
COMMENT ON COLUMN public.received_emails.resend_email_id IS 'ID único do email no Resend';
COMMENT ON COLUMN public.received_emails.thread_id IS 'ID do thread para agrupar conversas';
COMMENT ON COLUMN public.received_emails.in_reply_to IS 'Email ID que está respondendo';
COMMENT ON COLUMN public.received_emails.replied_by IS 'ID do admin que respondeu o email';

-- RLS Policies
ALTER TABLE public.received_emails ENABLE ROW LEVEL SECURITY;

-- Policy: Apenas admins podem ver emails recebidos
CREATE POLICY "Admins can view received emails"
  ON public.received_emails
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Policy: Apenas service_role pode inserir (via webhook)
CREATE POLICY "Service role can insert received emails"
  ON public.received_emails
  FOR INSERT
  WITH CHECK (true);

-- Policy: Apenas admins podem atualizar
CREATE POLICY "Admins can update received emails"
  ON public.received_emails
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

