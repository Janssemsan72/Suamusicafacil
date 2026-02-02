-- ==========================================
-- ATUALIZAR BOTÃO DO EMAIL DE PAGAMENTO CONFIRMADO
-- Substitui o botão "Começar a Criar Músicas" por "Fale conosco" 
-- que leva para o WhatsApp ao invés do site
-- ==========================================

-- Atualizar template payment_confirmed em português
-- Substitui o botão principal no cta-wrapper que leva para {{receipt_url}} por botão do WhatsApp
-- Preserva o link do recibo que está abaixo (não tem class="button")
DO $$
DECLARE
  v_html_content TEXT;
BEGIN
  SELECT html_content INTO v_html_content
  FROM email_templates_i18n
  WHERE template_type = 'payment_confirmed' 
    AND language = 'pt'
    AND html_content LIKE '%cta-wrapper%'
    AND html_content LIKE '%{{receipt_url}}%'
    AND html_content NOT LIKE '%wa.me/5585921919419%'
  LIMIT 1;
  
  IF v_html_content IS NOT NULL THEN
    -- Substituir apenas o botão dentro do cta-wrapper (que tem class="button")
    v_html_content := REPLACE(
      v_html_content,
      '<a href="{{receipt_url}}" class="button">',
      '<a href="https://wa.me/5585921919419" class="button">'
    );
    
    -- Substituir o texto do botão (pode variar)
    v_html_content := REGEXP_REPLACE(
      v_html_content,
      '(<a href="https://wa\.me/5585921919419" class="button">)[^<]+(</a>)',
      '\1Fale conosco\2',
      'g'
    );
    
    UPDATE email_templates_i18n
    SET html_content = v_html_content, updated_at = NOW()
    WHERE template_type = 'payment_confirmed' AND language = 'pt';
    
    RAISE NOTICE '✅ Template payment_confirmed (pt) atualizado!';
  END IF;
END $$;

-- Atualizar template payment_confirmed em inglês
DO $$
DECLARE
  v_html_content TEXT;
BEGIN
  SELECT html_content INTO v_html_content
  FROM email_templates_i18n
  WHERE template_type = 'payment_confirmed' 
    AND language = 'en'
    AND html_content LIKE '%cta-wrapper%'
    AND html_content LIKE '%{{receipt_url}}%'
    AND html_content NOT LIKE '%wa.me/5585921919419%'
  LIMIT 1;
  
  IF v_html_content IS NOT NULL THEN
    v_html_content := REPLACE(
      v_html_content,
      '<a href="{{receipt_url}}" class="button">',
      '<a href="https://wa.me/5585921919419" class="button">'
    );
    
    v_html_content := REGEXP_REPLACE(
      v_html_content,
      '(<a href="https://wa\.me/5585921919419" class="button">)[^<]+(</a>)',
      '\1Contact Us\2',
      'g'
    );
    
    UPDATE email_templates_i18n
    SET html_content = v_html_content, updated_at = NOW()
    WHERE template_type = 'payment_confirmed' AND language = 'en';
    
    RAISE NOTICE '✅ Template payment_confirmed (en) atualizado!';
  END IF;
END $$;

-- Atualizar template payment_confirmed em espanhol
DO $$
DECLARE
  v_html_content TEXT;
BEGIN
  SELECT html_content INTO v_html_content
  FROM email_templates_i18n
  WHERE template_type = 'payment_confirmed' 
    AND language = 'es'
    AND html_content LIKE '%cta-wrapper%'
    AND html_content LIKE '%{{receipt_url}}%'
    AND html_content NOT LIKE '%wa.me/5585921919419%'
  LIMIT 1;
  
  IF v_html_content IS NOT NULL THEN
    v_html_content := REPLACE(
      v_html_content,
      '<a href="{{receipt_url}}" class="button">',
      '<a href="https://wa.me/5585921919419" class="button">'
    );
    
    v_html_content := REGEXP_REPLACE(
      v_html_content,
      '(<a href="https://wa\.me/5585921919419" class="button">)[^<]+(</a>)',
      '\1Contáctanos\2',
      'g'
    );
    
    UPDATE email_templates_i18n
    SET html_content = v_html_content, updated_at = NOW()
    WHERE template_type = 'payment_confirmed' AND language = 'es';
    
    RAISE NOTICE '✅ Template payment_confirmed (es) atualizado!';
  END IF;
END $$;

-- Verificar se as atualizações foram aplicadas
DO $$
DECLARE
  pt_updated BOOLEAN;
  en_updated BOOLEAN;
  es_updated BOOLEAN;
BEGIN
  -- Verificar português
  SELECT html_content LIKE '%Fale conosco%' AND html_content LIKE '%wa.me/5585921919419%' INTO pt_updated
  FROM email_templates_i18n
  WHERE template_type = 'payment_confirmed' AND language = 'pt'
  LIMIT 1;
  
  -- Verificar inglês
  SELECT html_content LIKE '%Contact Us%' AND html_content LIKE '%wa.me/5585921919419%' INTO en_updated
  FROM email_templates_i18n
  WHERE template_type = 'payment_confirmed' AND language = 'en'
  LIMIT 1;
  
  -- Verificar espanhol
  SELECT html_content LIKE '%Contáctanos%' AND html_content LIKE '%wa.me/5585921919419%' INTO es_updated
  FROM email_templates_i18n
  WHERE template_type = 'payment_confirmed' AND language = 'es'
  LIMIT 1;
  
  IF pt_updated THEN
    RAISE NOTICE '✅ Template payment_confirmed (pt) atualizado com botão "Fale conosco" para WhatsApp!';
  ELSE
    RAISE WARNING '⚠️ Template payment_confirmed (pt) NÃO foi atualizado ou não existe.';
  END IF;
  
  IF en_updated THEN
    RAISE NOTICE '✅ Template payment_confirmed (en) atualizado com botão "Contact Us" para WhatsApp!';
  ELSE
    RAISE WARNING '⚠️ Template payment_confirmed (en) NÃO foi atualizado ou não existe.';
  END IF;
  
  IF es_updated THEN
    RAISE NOTICE '✅ Template payment_confirmed (es) atualizado com botão "Contáctanos" para WhatsApp!';
  ELSE
    RAISE WARNING '⚠️ Template payment_confirmed (es) NÃO foi atualizado ou não existe.';
  END IF;
END $$;

