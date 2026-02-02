-- ==========================================
-- ADICIONAR WHATSAPP NOS TEMPLATES DE EMAIL
-- Adiciona número de WhatsApp (85) 921919419 no footer dos templates
-- order_paid (pedido confirmado) e music_released (música pronta) em português
-- ==========================================

-- Atualizar template order_paid em português
DO $$
DECLARE
  v_html_content TEXT;
  v_whatsapp_line TEXT := E'          <p>📱 WhatsApp: <a href="https://wa.me/5585921919419" style="color:#C7855E;">(85) 921919419</a></p>\n';
  v_updated BOOLEAN := FALSE;
BEGIN
  -- Buscar template order_paid
  SELECT html_content INTO v_html_content
  FROM email_templates_i18n
  WHERE template_type = 'order_paid' 
    AND language = 'pt'
    AND html_content NOT LIKE '%WhatsApp: <a href="https://wa.me/5585921919419"%'
  LIMIT 1;
  
  IF v_html_content IS NOT NULL THEN
    -- Tentar adicionar após "Este é um email automático. Em caso de dúvidas, entre em contato conosco."
    IF v_html_content LIKE '%Este é um email automático. Em caso de dúvidas, entre em contato conosco.%' THEN
      v_html_content := REPLACE(
        v_html_content,
        '<p>Este é um email automático. Em caso de dúvidas, entre em contato conosco.</p>',
        '<p>Este é um email automático. Em caso de dúvidas, entre em contato conosco.</p>' || v_whatsapp_line
      );
      v_updated := TRUE;
    -- Tentar adicionar após "Este é um email automático. Para suporte, responda este email."
    ELSIF v_html_content LIKE '%Este é um email automático. Para suporte, responda este email.%' THEN
      v_html_content := REPLACE(
        v_html_content,
        '<p>Este é um email automático. Para suporte, responda este email.</p>',
        '<p>Este é um email automático. Para suporte, responda este email.</p>' || v_whatsapp_line
      );
      v_updated := TRUE;
    -- Tentar adicionar antes do fechamento do footer se nenhum padrão específico for encontrado
    ELSIF v_html_content LIKE '%</div>%</div>%</body>%' THEN
      -- Adicionar antes do último </div> do footer
      v_html_content := REGEXP_REPLACE(
        v_html_content,
        '(</div>\s*</div>\s*</body>)',
        v_whatsapp_line || E'\n        \1',
        'g'
      );
      v_updated := TRUE;
    END IF;
    
    IF v_updated THEN
      UPDATE email_templates_i18n
      SET html_content = v_html_content, updated_at = NOW()
      WHERE template_type = 'order_paid' AND language = 'pt';
      
      RAISE NOTICE '✅ Template order_paid (pt) atualizado com WhatsApp!';
    ELSE
      RAISE WARNING '⚠️ Template order_paid (pt) não foi atualizado. Formato do footer não reconhecido.';
    END IF;
  ELSE
    RAISE NOTICE 'ℹ️ Template order_paid (pt) já possui WhatsApp ou não existe.';
  END IF;
END $$;

-- Atualizar template music_released em português
DO $$
DECLARE
  v_html_content TEXT;
  v_whatsapp_line TEXT := E'          <p>📱 WhatsApp: <a href="https://wa.me/5585921919419" style="color:#C18B67;">(85) 921919419</a></p>\n';
  v_updated BOOLEAN := FALSE;
BEGIN
  -- Buscar template music_released
  SELECT html_content INTO v_html_content
  FROM email_templates_i18n
  WHERE template_type = 'music_released' 
    AND language = 'pt'
    AND html_content NOT LIKE '%WhatsApp: <a href="https://wa.me/5585921919419"%'
  LIMIT 1;
  
  IF v_html_content IS NOT NULL THEN
    -- Tentar adicionar após "Este é um email automático. Em caso de dúvidas, entre em contato conosco."
    IF v_html_content LIKE '%Este é um email automático. Em caso de dúvidas, entre em contato conosco.%' THEN
      v_html_content := REPLACE(
        v_html_content,
        '<p>Este é um email automático. Em caso de dúvidas, entre em contato conosco.</p>',
        '<p>Este é um email automático. Em caso de dúvidas, entre em contato conosco.</p>' || v_whatsapp_line
      );
      v_updated := TRUE;
    -- Tentar adicionar após "Este é um email automático. Para suporte, responda este email."
    ELSIF v_html_content LIKE '%Este é um email automático. Para suporte, responda este email.%' THEN
      v_html_content := REPLACE(
        v_html_content,
        '<p>Este é um email automático. Para suporte, responda este email.</p>',
        '<p>Este é um email automático. Para suporte, responda este email.</p>' || v_whatsapp_line
      );
      v_updated := TRUE;
    -- Tentar adicionar antes do fechamento do footer se nenhum padrão específico for encontrado
    ELSIF v_html_content LIKE '%</div>%</div>%</body>%' THEN
      -- Adicionar antes do último </div> do footer
      v_html_content := REGEXP_REPLACE(
        v_html_content,
        '(</div>\s*</div>\s*</body>)',
        v_whatsapp_line || E'\n        \1',
        'g'
      );
      v_updated := TRUE;
    END IF;
    
    IF v_updated THEN
      UPDATE email_templates_i18n
      SET html_content = v_html_content, updated_at = NOW()
      WHERE template_type = 'music_released' AND language = 'pt';
      
      RAISE NOTICE '✅ Template music_released (pt) atualizado com WhatsApp!';
    ELSE
      RAISE WARNING '⚠️ Template music_released (pt) não foi atualizado. Formato do footer não reconhecido.';
    END IF;
  ELSE
    RAISE NOTICE 'ℹ️ Template music_released (pt) já possui WhatsApp ou não existe.';
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
  WHERE template_type = 'order_paid' AND language = 'pt'
  LIMIT 1;
  
  -- Verificar music_released
  SELECT html_content LIKE '%WhatsApp: <a href="https://wa.me/5585921919419"%' INTO music_released_updated
  FROM email_templates_i18n
  WHERE template_type = 'music_released' AND language = 'pt'
  LIMIT 1;
  
  IF order_paid_updated THEN
    RAISE NOTICE '✅ Template order_paid (pt) possui WhatsApp!';
  ELSE
    RAISE WARNING '⚠️ Template order_paid (pt) NÃO possui WhatsApp.';
  END IF;
  
  IF music_released_updated THEN
    RAISE NOTICE '✅ Template music_released (pt) possui WhatsApp!';
  ELSE
    RAISE WARNING '⚠️ Template music_released (pt) NÃO possui WhatsApp.';
  END IF;
END $$;

