-- ==========================================
-- ADICIONAR WHATSAPP NOS TEMPLATES DE EMAIL EM PORTUGUÊS
-- Adiciona número de WhatsApp (85) 921919419 no footer dos templates
-- order_paid e music_released em português
-- ==========================================

-- Atualizar template order_paid em português
-- Usa função PL/pgSQL para adicionar WhatsApp de forma mais robusta
DO $$
DECLARE
  v_html_content TEXT;
  v_whatsapp_line TEXT := E'          <p>📱 WhatsApp: <a href="https://wa.me/5585921919419" style="color:#C7855E;">(85) 921919419</a></p>\n';
BEGIN
  -- Buscar e atualizar order_paid
  SELECT html_content INTO v_html_content
  FROM email_templates_i18n
  WHERE template_type = 'order_paid' 
    AND language = 'pt'
    AND html_content LIKE '%Este é um email automático. Em caso de dúvidas, entre em contato conosco.%'
    AND html_content NOT LIKE '%WhatsApp: <a href="https://wa.me/5585921919419"%'
  LIMIT 1;
  
  IF v_html_content IS NOT NULL THEN
    -- Adicionar WhatsApp após a linha de contato
    v_html_content := REPLACE(
      v_html_content,
      '<p>Este é um email automático. Em caso de dúvidas, entre em contato conosco.</p>',
      '<p>Este é um email automático. Em caso de dúvidas, entre em contato conosco.</p>' || v_whatsapp_line
    );
    
    UPDATE email_templates_i18n
    SET html_content = v_html_content, updated_at = NOW()
    WHERE template_type = 'order_paid' AND language = 'pt';
  END IF;
END $$;

-- Atualizar template music_released em português
-- Usa função PL/pgSQL para adicionar WhatsApp de forma mais robusta
DO $$
DECLARE
  v_html_content TEXT;
  v_whatsapp_line TEXT := E'          <p>📱 WhatsApp: <a href="https://wa.me/5585921919419" style="color:#C7855E;">(85) 921919419</a></p>\n';
BEGIN
  -- Buscar e atualizar music_released
  SELECT html_content INTO v_html_content
  FROM email_templates_i18n
  WHERE template_type = 'music_released' 
    AND language = 'pt'
    AND html_content LIKE '%Este é um email automático. Em caso de dúvidas, entre em contato conosco.%'
    AND html_content NOT LIKE '%WhatsApp: <a href="https://wa.me/5585921919419"%'
  LIMIT 1;
  
  IF v_html_content IS NOT NULL THEN
    -- Adicionar WhatsApp após a linha de contato
    v_html_content := REPLACE(
      v_html_content,
      '<p>Este é um email automático. Em caso de dúvidas, entre em contato conosco.</p>',
      '<p>Este é um email automático. Em caso de dúvidas, entre em contato conosco.</p>' || v_whatsapp_line
    );
    
    UPDATE email_templates_i18n
    SET html_content = v_html_content, updated_at = NOW()
    WHERE template_type = 'music_released' AND language = 'pt';
  END IF;
END $$;

-- Verificar se as atualizações foram aplicadas
DO $$
DECLARE
  order_paid_updated BOOLEAN;
  music_released_updated BOOLEAN;
BEGIN
  -- Verificar order_paid
  SELECT html_content LIKE '%WhatsApp: <a href="https://wa.me/5585921919419"%' INTO order_paid_updated
  FROM email_templates_i18n
  WHERE template_type = 'order_paid' AND language = 'pt';
  
  -- Verificar music_released
  SELECT html_content LIKE '%WhatsApp: <a href="https://wa.me/5585921919419"%' INTO music_released_updated
  FROM email_templates_i18n
  WHERE template_type = 'music_released' AND language = 'pt';
  
  IF order_paid_updated THEN
    RAISE NOTICE '✅ Template order_paid (pt) atualizado com sucesso!';
  ELSE
    RAISE WARNING '⚠️ Template order_paid (pt) não foi atualizado. Verifique se o template existe.';
  END IF;
  
  IF music_released_updated THEN
    RAISE NOTICE '✅ Template music_released (pt) atualizado com sucesso!';
  ELSE
    RAISE WARNING '⚠️ Template music_released (pt) não foi atualizado. Verifique se o template existe.';
  END IF;
END $$;

