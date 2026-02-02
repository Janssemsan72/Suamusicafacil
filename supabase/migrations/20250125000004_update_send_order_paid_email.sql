-- ==========================================
-- ATUALIZAR FUNÇÃO send_order_paid_email
-- Para usar email_templates_es em vez de email_templates_i18n
-- ==========================================

CREATE OR REPLACE FUNCTION send_order_paid_email(
  p_order_id UUID,
  p_language TEXT DEFAULT 'es'
) RETURNS JSONB AS $$
DECLARE
  template_record RECORD;
  variables JSONB;
  result JSONB;
  table_name TEXT;
BEGIN
  -- Determinar tabela baseada no idioma
  IF p_language = 'es' THEN
    table_name := 'email_templates_es';
  ELSIF p_language = 'pt' THEN
    table_name := 'email_templates_pt';
  ELSE
    -- Fallback para espanhol
    table_name := 'email_templates_es';
  END IF;

  -- Buscar template da tabela correta
  EXECUTE format('
    SELECT 
      id,
      subject,
      html_content,
      variables,
      from_name,
      from_email,
      reply_to
    FROM %I
    WHERE template_type = $1
    LIMIT 1
  ', table_name) INTO template_record USING 'order_paid';

  IF template_record.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Template not found for order_paid/%s in %s', p_language, table_name)
    );
  END IF;

  -- Obter variáveis
  variables := get_order_paid_variables(p_order_id);

  -- Retornar dados para envio
  result := jsonb_build_object(
    'success', true,
    'template_id', template_record.id,
    'subject', template_record.subject,
    'html_content', template_record.html_content,
    'variables', variables,
    'to_email', variables->>'customer_email',
    'from_name', template_record.from_name,
    'from_email', template_record.from_email,
    'reply_to', template_record.reply_to
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentário de documentação
COMMENT ON FUNCTION send_order_paid_email(UUID, TEXT) IS 
'Envia email order_paid usando templates de email_templates_es ou email_templates_pt baseado no idioma. Retorna template e variáveis extraídas do pedido.';




















