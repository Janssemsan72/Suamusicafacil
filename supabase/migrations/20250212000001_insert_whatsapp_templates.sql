-- ==========================================
-- INSERIR TEMPLATES INICIAIS DE WHATSAPP
-- Templates padrão em pt, en, es
-- ==========================================

-- Template: payment_confirmed (PT)
INSERT INTO whatsapp_templates_i18n (template_type, language, message_text, button_configs, variables)
VALUES (
  'payment_confirmed',
  'pt',
  'Olá {first_name},

Seu pagamento foi confirmado. Já estamos criando algo especial para {destinatario}.

Detalhes do Pedido:
Número: {order_number}
Estilo: {style}
Plano: {plan}
Previsão de entrega: {delivery_time}
Data de lançamento: {release_date}

Nossa equipe está trabalhando com muito cuidado para entregar uma experiência única.

Obrigado por confiar na Music Lovely.',
  '{
    "buttons": []
  }'::jsonb,
  '[
    {"name": "first_name", "description": "Primeiro nome do cliente"},
    {"name": "destinatario", "description": "Nome da pessoa para quem é a música"},
    {"name": "order_number", "description": "Número do pedido"},
    {"name": "style", "description": "Estilo musical"},
    {"name": "plan", "description": "Plano (Standard/Express)"},
    {"name": "delivery_time", "description": "Tempo de entrega"},
    {"name": "release_date", "description": "Data de lançamento"}
  ]'::jsonb
) ON CONFLICT (template_type, language) DO NOTHING;

-- Template: payment_confirmed (EN)
INSERT INTO whatsapp_templates_i18n (template_type, language, message_text, button_configs, variables)
VALUES (
  'payment_confirmed',
  'en',
  'Hello {first_name},

Your payment has been confirmed. We are already creating something special for {destinatario}.

Order Details:
Number: {order_number}
Style: {style}
Plan: {plan}
Estimated delivery: {delivery_time}
Release date: {release_date}

Our team is working with great care to deliver a unique experience.

Thank you for trusting Music Lovely.',
  '{
    "buttons": []
  }'::jsonb,
  '[
    {"name": "first_name", "description": "Customer first name"},
    {"name": "destinatario", "description": "Name of the person the song is for"},
    {"name": "order_number", "description": "Order number"},
    {"name": "style", "description": "Music style"},
    {"name": "plan", "description": "Plan (Standard/Express)"},
    {"name": "delivery_time", "description": "Delivery time"},
    {"name": "release_date", "description": "Release date"}
  ]'::jsonb
) ON CONFLICT (template_type, language) DO NOTHING;

-- Template: payment_confirmed (ES)
INSERT INTO whatsapp_templates_i18n (template_type, language, message_text, button_configs, variables)
VALUES (
  'payment_confirmed',
  'es',
  'Hola {first_name},

Tu pago ha sido confirmado. Ya estamos creando algo especial para {destinatario}.

Detalles del Pedido:
Número: {order_number}
Estilo: {style}
Plan: {plan}
Tiempo de entrega: {delivery_time}
Fecha de lanzamiento: {release_date}

Nuestro equipo está trabajando con mucho cuidado para entregar una experiencia única.

Gracias por confiar en Music Lovely.',
  '{
    "buttons": []
  }'::jsonb,
  '[
    {"name": "first_name", "description": "Nombre del cliente"},
    {"name": "destinatario", "description": "Nombre de la persona para quien es la canción"},
    {"name": "order_number", "description": "Número de pedido"},
    {"name": "style", "description": "Estilo musical"},
    {"name": "plan", "description": "Plan (Standard/Express)"},
    {"name": "delivery_time", "description": "Tiempo de entrega"},
    {"name": "release_date", "description": "Fecha de lanzamiento"}
  ]'::jsonb
) ON CONFLICT (template_type, language) DO NOTHING;

-- Template: music_ready (PT)
INSERT INTO whatsapp_templates_i18n (template_type, language, message_text, button_configs, variables)
VALUES (
  'music_ready',
  'pt',
  'Olá {first_name},

Sua música está pronta.

Música para {destinatario}
Estilo: {style}
Duração: {duration}

Músicas criadas:
1. {song_title_1}
2. {song_title_2}

Baixe e compartilhe agora.',
  '{
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
  '[
    {"name": "first_name", "description": "Primeiro nome do cliente"},
    {"name": "destinatario", "description": "Nome da pessoa para quem é a música"},
    {"name": "style", "description": "Estilo musical"},
    {"name": "duration", "description": "Duração da música"},
    {"name": "song_title_1", "description": "Título da música 1"},
    {"name": "song_title_2", "description": "Título da música 2"},
    {"name": "download_url_1", "description": "URL de download música 1"},
    {"name": "download_url_2", "description": "URL de download música 2 (pode ser igual à música 1 se houver apenas 1 música)"}
  ]'::jsonb
) ON CONFLICT (template_type, language) DO NOTHING;

-- Template: music_ready (EN)
INSERT INTO whatsapp_templates_i18n (template_type, language, message_text, button_configs, variables)
VALUES (
  'music_ready',
  'en',
  'Hello {first_name},

Your music is ready.

Music for {destinatario}
Style: {style}
Duration: {duration}

Songs created:
1. {song_title_1}
2. {song_title_2}

Download and share now.',
  '{
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
  '[
    {"name": "first_name", "description": "Customer first name"},
    {"name": "destinatario", "description": "Name of the person the song is for"},
    {"name": "style", "description": "Music style"},
    {"name": "duration", "description": "Song duration"},
    {"name": "song_title_1", "description": "Song 1 title"},
    {"name": "song_title_2", "description": "Song 2 title"},
    {"name": "download_url_1", "description": "Download URL for song 1"},
    {"name": "download_url_2", "description": "Download URL for song 2 (can be same as song 1 if only 1 song exists)"}
  ]'::jsonb
) ON CONFLICT (template_type, language) DO NOTHING;

-- Template: music_ready (ES)
INSERT INTO whatsapp_templates_i18n (template_type, language, message_text, button_configs, variables)
VALUES (
  'music_ready',
  'es',
  'Hola {first_name},

Tu música está lista.

Música para {destinatario}
Estilo: {style}
Duración: {duration}

Canciones creadas:
1. {song_title_1}
2. {song_title_2}

Descarga y comparte ahora.',
  '{
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
  '[
    {"name": "first_name", "description": "Nombre del cliente"},
    {"name": "destinatario", "description": "Nombre de la persona para quien es la canción"},
    {"name": "style", "description": "Estilo musical"},
    {"name": "duration", "description": "Duración de la canción"},
    {"name": "song_title_1", "description": "Título de la canción 1"},
    {"name": "song_title_2", "description": "Título de la canción 2"},
    {"name": "download_url_1", "description": "URL de descarga canción 1"},
    {"name": "download_url_2", "description": "URL de descarga canción 2 (puede ser igual a la canción 1 si solo hay 1 canción)"}
  ]'::jsonb
) ON CONFLICT (template_type, language) DO NOTHING;
