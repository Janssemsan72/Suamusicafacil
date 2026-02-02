-- ==========================================
-- REMOVER NEGRITO DA PRIMEIRA FRASE DO TEMPLATE "MÚSICA PRONTA"
-- ==========================================
-- Remove qualquer formatação de negrito (*texto* ou **texto**) da primeira frase
-- e garante que a primeira frase seja sempre texto simples

-- Template: music_ready (PT)
UPDATE whatsapp_templates_i18n
SET message_text = 'Olá {first_name},

Sua música está pronta.

Música para {destinatario}
Estilo: {style}
Duração: {duration}

Músicas criadas:
1. {song_title_1}
2. {song_title_2}

Baixe e compartilhe agora.',
  updated_at = NOW()
WHERE template_type = 'music_ready' 
  AND language = 'pt';

-- Template: music_ready (EN)
UPDATE whatsapp_templates_i18n
SET message_text = 'Hello {first_name},

Your music is ready.

Music for {destinatario}
Style: {style}
Duration: {duration}

Songs created:
1. {song_title_1}
2. {song_title_2}

Download and share now.',
  updated_at = NOW()
WHERE template_type = 'music_ready' 
  AND language = 'en';

-- Template: music_ready (ES)
UPDATE whatsapp_templates_i18n
SET message_text = 'Hola {first_name},

Tu música está lista.

Música para {destinatario}
Estilo: {style}
Duración: {duration}

Canciones creadas:
1. {song_title_1}
2. {song_title_2}

Descarga y comparte ahora.',
  updated_at = NOW()
WHERE template_type = 'music_ready' 
  AND language = 'es';


