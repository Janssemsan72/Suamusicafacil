-- ==========================================
-- REMOVER BOTÃO DO WHATSAPP E ADICIONAR CONTATO EM TEXTO
-- Remove apenas botões que redirecionam para WhatsApp
-- Mantém botões de download das músicas
-- Adiciona número do WhatsApp e email em texto normal
-- ==========================================

-- Atualizar template order_paid em português
DO $$
DECLARE
  v_html_content TEXT;
  v_contact_info TEXT := E'          <p>📱 WhatsApp: (85) 921919419</p>\n          <p>📧 Email: musiclovelycakto@gmail.com</p>\n';
  v_updated BOOLEAN := FALSE;
BEGIN
  -- Buscar template order_paid
  SELECT html_content INTO v_html_content
  FROM email_templates_i18n
  WHERE template_type = 'order_paid' 
    AND language = 'pt'
  LIMIT 1;
  
  IF v_html_content IS NOT NULL THEN
    -- Remover apenas botões que redirecionam para WhatsApp (wa.me)
    v_html_content := REGEXP_REPLACE(
      v_html_content,
      '<a[^>]*href="[^"]*wa\.me[^"]*"[^>]*>.*?</a>',
      '',
      'gs'
    );
    
    -- Remover link do WhatsApp se existir e substituir por texto simples
    v_html_content := REGEXP_REPLACE(
      v_html_content,
      '<p>📱 WhatsApp: <a[^>]*>\(85\) 921919419</a></p>',
      '<p>📱 WhatsApp: (85) 921919419</p>',
      'gs'
    );
    
    -- Adicionar informações de contato no footer
    -- Tentar adicionar após "Este é um email automático. Em caso de dúvidas, entre em contato conosco."
    IF v_html_content LIKE '%Este é um email automático. Em caso de dúvidas, entre em contato conosco.%' THEN
      v_html_content := REPLACE(
        v_html_content,
        '<p>Este é um email automático. Em caso de dúvidas, entre em contato conosco.</p>',
        '<p>Este é um email automático. Em caso de dúvidas, entre em contato conosco.</p>' || v_contact_info
      );
      v_updated := TRUE;
    -- Tentar adicionar após "Este é um email automático. Para suporte, responda este email."
    ELSIF v_html_content LIKE '%Este é um email automático. Para suporte, responda este email.%' THEN
      v_html_content := REPLACE(
        v_html_content,
        '<p>Este é um email automático. Para suporte, responda este email.</p>',
        '<p>Este é um email automático. Para suporte, responda este email.</p>' || v_contact_info
      );
      v_updated := TRUE;
    -- Se não encontrar padrão específico, adicionar antes do fechamento do footer
    ELSIF v_html_content LIKE '%</div>%</div>%</body>%' THEN
      -- Adicionar antes do último </div> do footer
      v_html_content := REGEXP_REPLACE(
        v_html_content,
        '(</div>\s*</div>\s*</body>)',
        v_contact_info || E'\n        \1',
        'g'
      );
      v_updated := TRUE;
    END IF;
    
    IF v_updated OR v_html_content IS NOT NULL THEN
      UPDATE email_templates_i18n
      SET html_content = v_html_content, updated_at = NOW()
      WHERE template_type = 'order_paid' AND language = 'pt';
      
      RAISE NOTICE '✅ Template order_paid (pt) atualizado!';
    ELSE
      RAISE WARNING '⚠️ Template order_paid (pt) não foi atualizado.';
    END IF;
  ELSE
    RAISE WARNING '⚠️ Template order_paid (pt) não encontrado.';
  END IF;
END $$;

-- Atualizar template music_released em português
DO $$
DECLARE
  v_html_content TEXT;
  v_contact_info TEXT := E'          <p>📱 WhatsApp: (85) 921919419</p>\n          <p>📧 Email: musiclovelycakto@gmail.com</p>\n';
  v_updated BOOLEAN := FALSE;
BEGIN
  -- Buscar template music_released
  SELECT html_content INTO v_html_content
  FROM email_templates_i18n
  WHERE template_type = 'music_released' 
    AND language = 'pt'
  LIMIT 1;
  
  IF v_html_content IS NOT NULL THEN
    -- Remover apenas botões que redirecionam para WhatsApp (wa.me)
    -- MANTER botões de download (download_url_1, download_url_2)
    v_html_content := REGEXP_REPLACE(
      v_html_content,
      '<a[^>]*href="[^"]*wa\.me[^"]*"[^>]*>.*?</a>',
      '',
      'gs'
    );
    
    -- Remover link do WhatsApp se existir e substituir por texto simples
    v_html_content := REGEXP_REPLACE(
      v_html_content,
      '<p>📱 WhatsApp: <a[^>]*>\(85\) 921919419</a></p>',
      '<p>📱 WhatsApp: (85) 921919419</p>',
      'gs'
    );
    
    -- Adicionar informações de contato no footer
    -- Tentar adicionar após "Este é um email automático. Em caso de dúvidas, entre em contato conosco."
    IF v_html_content LIKE '%Este é um email automático. Em caso de dúvidas, entre em contato conosco.%' THEN
      v_html_content := REPLACE(
        v_html_content,
        '<p>Este é um email automático. Em caso de dúvidas, entre em contato conosco.</p>',
        '<p>Este é um email automático. Em caso de dúvidas, entre em contato conosco.</p>' || v_contact_info
      );
      v_updated := TRUE;
    -- Tentar adicionar após "Este é um email automático. Para suporte, responda este email."
    ELSIF v_html_content LIKE '%Este é um email automático. Para suporte, responda este email.%' THEN
      v_html_content := REPLACE(
        v_html_content,
        '<p>Este é um email automático. Para suporte, responda este email.</p>',
        '<p>Este é um email automático. Para suporte, responda este email.</p>' || v_contact_info
      );
      v_updated := TRUE;
    -- Se não encontrar padrão específico, adicionar antes do fechamento do footer
    ELSIF v_html_content LIKE '%</div>%</div>%</body>%' THEN
      -- Adicionar antes do último </div> do footer
      v_html_content := REGEXP_REPLACE(
        v_html_content,
        '(</div>\s*</div>\s*</body>)',
        v_contact_info || E'\n        \1',
        'g'
      );
      v_updated := TRUE;
    END IF;
    
    IF v_updated OR v_html_content IS NOT NULL THEN
      UPDATE email_templates_i18n
      SET html_content = v_html_content, updated_at = NOW()
      WHERE template_type = 'music_released' AND language = 'pt';
      
      RAISE NOTICE '✅ Template music_released (pt) atualizado!';
    ELSE
      RAISE WARNING '⚠️ Template music_released (pt) não foi atualizado.';
    END IF;
  ELSE
    RAISE WARNING '⚠️ Template music_released (pt) não encontrado.';
  END IF;
END $$;

-- Verificar se as atualizações foram aplicadas
DO $$
DECLARE
  order_paid_has_contact BOOLEAN;
  music_released_has_contact BOOLEAN;
  order_paid_has_button BOOLEAN;
  music_released_has_button BOOLEAN;
  music_released_has_download BOOLEAN;
BEGIN
  -- Verificar order_paid
  SELECT 
    html_content LIKE '%📱 WhatsApp: (85) 921919419%' AND html_content LIKE '%musiclovelycakto@gmail.com%',
    html_content LIKE '%wa\.me%'
  INTO order_paid_has_contact, order_paid_has_button
  FROM email_templates_i18n
  WHERE template_type = 'order_paid' AND language = 'pt'
  LIMIT 1;
  
  -- Verificar music_released
  SELECT 
    html_content LIKE '%📱 WhatsApp: (85) 921919419%' AND html_content LIKE '%musiclovelycakto@gmail.com%',
    html_content LIKE '%wa\.me%'
  INTO music_released_has_contact, music_released_has_button
  FROM email_templates_i18n
  WHERE template_type = 'music_released' AND language = 'pt'
  LIMIT 1;
  
  -- Verificar se botões de download foram mantidos no music_released
  SELECT html_content LIKE '%download_url_1%' OR html_content LIKE '%download_url_2%'
  INTO music_released_has_download
  FROM email_templates_i18n
  WHERE template_type = 'music_released' AND language = 'pt'
  LIMIT 1;
  
  IF order_paid_has_contact AND NOT order_paid_has_button THEN
    RAISE NOTICE '✅ Template order_paid (pt) atualizado corretamente!';
  ELSE
    RAISE WARNING '⚠️ Template order_paid (pt) precisa de verificação. Contato: %, Botão WhatsApp: %', order_paid_has_contact, order_paid_has_button;
  END IF;
  
  IF music_released_has_contact AND NOT music_released_has_button AND music_released_has_download THEN
    RAISE NOTICE '✅ Template music_released (pt) atualizado corretamente! Botões de download mantidos.';
  ELSE
    RAISE WARNING '⚠️ Template music_released (pt) precisa de verificação. Contato: %, Botão WhatsApp: %, Download: %', music_released_has_contact, music_released_has_button, music_released_has_download;
  END IF;
END $$;

