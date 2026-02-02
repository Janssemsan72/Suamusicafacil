-- ==========================================
-- CORREÇÃO: Função log_email_send - sent_at NOT NULL
-- ==========================================
-- Problema: A função estava tentando inserir NULL em sent_at quando status != 'sent',
-- mas a coluna sent_at tem constraint NOT NULL.
-- Solução: Sempre inserir NOW() em sent_at, independente do status.
-- Isso faz sentido porque sent_at representa quando a tentativa de envio foi registrada.
-- ==========================================

CREATE OR REPLACE FUNCTION log_email_send(
  p_template_type TEXT,
  p_language TEXT,
  p_recipient_email TEXT,
  p_subject TEXT,
  p_status TEXT,
  p_error_message TEXT DEFAULT NULL,
  p_resend_id TEXT DEFAULT NULL,
  p_order_id UUID DEFAULT NULL,
  p_song_id UUID DEFAULT NULL,
  p_variables JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO email_logs (
    email_type,  -- ✅ CORREÇÃO: usar email_type em vez de template_type
    recipient_email,
    resend_email_id,  -- ✅ CORREÇÃO: usar resend_email_id em vez de resend_id
    status,
    order_id,
    song_id,
    metadata,  -- ✅ CORREÇÃO: usar metadata para armazenar language, subject, variables
    sent_at,  -- ✅ CORREÇÃO: sempre inserir NOW(), nunca NULL
    created_at
  ) VALUES (
    p_template_type,  -- template_type é mapeado para email_type
    p_recipient_email,
    p_resend_id,  -- resend_id é mapeado para resend_email_id
    p_status,
    p_order_id,
    p_song_id,
    jsonb_build_object(
      'language', p_language,
      'subject', p_subject,
      'variables', COALESCE(p_variables, '{}'::jsonb),
      'error_message', p_error_message
    ),
    NOW(),  -- ✅ CORREÇÃO: sempre inserir NOW() em vez de CASE WHEN p_status = 'sent' THEN NOW() ELSE NULL END
    NOW()
  ) RETURNING id INTO log_id;

  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentário explicativo
COMMENT ON FUNCTION log_email_send IS 
'Registra log de envio de email. Sempre insere NOW() em sent_at para representar quando a tentativa foi registrada, independente do status (sent/failed).';









