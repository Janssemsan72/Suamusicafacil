-- ==========================================
-- REMOVER BOTÃO "Ver Todas as Músicas" DOS TEMPLATES
-- Garantir que só tenha 2 botões de download
-- ==========================================

-- Atualizar template music_ready PT - garantir apenas 2 botões de download
UPDATE whatsapp_templates_i18n
SET button_configs = '{
  "buttons": [
    {
      "id": "download_1",
      "text": "{{song_title_1}}",
      "type": "url",
      "url_template": "{{download_url_1}}"
    },
    {
      "id": "download_2",
      "text": "{{song_title_2}}",
      "type": "url",
      "url_template": "{{download_url_2}}"
    }
  ]
}'::jsonb,
updated_at = NOW()
WHERE template_type = 'music_ready' 
  AND language = 'pt';

-- Atualizar template music_ready EN - garantir apenas 2 botões de download
UPDATE whatsapp_templates_i18n
SET button_configs = '{
  "buttons": [
    {
      "id": "download_1",
      "text": "{{song_title_1}}",
      "type": "url",
      "url_template": "{{download_url_1}}"
    },
    {
      "id": "download_2",
      "text": "{{song_title_2}}",
      "type": "url",
      "url_template": "{{download_url_2}}"
    }
  ]
}'::jsonb,
updated_at = NOW()
WHERE template_type = 'music_ready' 
  AND language = 'en';

-- Atualizar template music_ready ES - garantir apenas 2 botões de download
UPDATE whatsapp_templates_i18n
SET button_configs = '{
  "buttons": [
    {
      "id": "download_1",
      "text": "{{song_title_1}}",
      "type": "url",
      "url_template": "{{download_url_1}}"
    },
    {
      "id": "download_2",
      "text": "{{song_title_2}}",
      "type": "url",
      "url_template": "{{download_url_2}}"
    }
  ]
}'::jsonb,
updated_at = NOW()
WHERE template_type = 'music_ready' 
  AND language = 'es';
