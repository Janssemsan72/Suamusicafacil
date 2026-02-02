-- ==========================================
-- ADICIONAR TEMPLATES DE WHATSAPP FALTANTES
-- Templates para checkout_reminder, follow_up_1, follow_up_2, follow_up_3, order_paid
-- ==========================================

-- 1. Atualizar constraint para aceitar novos tipos de templates
ALTER TABLE whatsapp_templates_i18n
DROP CONSTRAINT IF EXISTS valid_whatsapp_template_type;

ALTER TABLE whatsapp_templates_i18n
ADD CONSTRAINT valid_whatsapp_template_type 
CHECK (template_type IN (
  'payment_confirmed',
  'music_ready',
  'checkout_reminder',
  'follow_up_1',
  'follow_up_2',
  'follow_up_3',
  'order_paid'
));

-- 2. Atualizar comentário da coluna
COMMENT ON COLUMN whatsapp_templates_i18n.template_type IS 'Tipo do template (payment_confirmed, music_ready, checkout_reminder, follow_up_1, follow_up_2, follow_up_3, order_paid)';

-- ==========================================
-- TEMPLATE: checkout_reminder
-- ==========================================

-- checkout_reminder (PT)
INSERT INTO whatsapp_templates_i18n (template_type, language, message_text, button_configs, variables)
VALUES (
  'checkout_reminder',
  'pt',
  'Oi {first_name}! 👋

Sua música personalizada para {destinatario} está quase pronta e ficou incrível! 🎵

Imagina a reação quando {destinatario} ouvir uma canção feita especialmente para ele(a)...

✨ Um momento único que vai ficar na memória para sempre
💝 Um presente que mostra o quanto você se importa
🎶 Uma história de amor contada em música

Estamos aqui para tornar esse momento ainda mais especial. É só finalizar e em até 24h você recebe sua música pronta! ⚡

💛 Não deixe essa oportunidade passar - {destinatario} vai adorar!',
  '{
    "buttons": [
      {
        "id": "checkout",
        "text": "🚀 Finalizar Agora",
        "type": "url",
        "url_template": "{checkout_url}"
      }
    ]
  }'::jsonb,
  '[
    {"name": "first_name", "description": "Primeiro nome do cliente"},
    {"name": "destinatario", "description": "Nome da pessoa para quem é a música"},
    {"name": "checkout_url", "description": "URL do checkout para finalizar pagamento"}
  ]'::jsonb
) ON CONFLICT (template_type, language) DO UPDATE SET
  message_text = EXCLUDED.message_text,
  button_configs = EXCLUDED.button_configs,
  variables = EXCLUDED.variables,
  updated_at = NOW();

-- checkout_reminder (EN)
INSERT INTO whatsapp_templates_i18n (template_type, language, message_text, button_configs, variables)
VALUES (
  'checkout_reminder',
  'en',
  'Hi {first_name}! 👋

Your personalized song for {destinatario} is almost ready and it sounds amazing! 🎵

Imagine the reaction when {destinatario} hears a song made especially for them...

✨ A unique moment that will last forever in memory
💝 A gift that shows how much you care
🎶 A love story told through music

We''re here to make this moment even more special. Just complete your order and within 24h you''ll receive your ready song! ⚡

💛 Don''t let this opportunity pass - {destinatario} will love it!',
  '{
    "buttons": [
      {
        "id": "checkout",
        "text": "🚀 Complete Now",
        "type": "url",
        "url_template": "{checkout_url}"
      }
    ]
  }'::jsonb,
  '[
    {"name": "first_name", "description": "Customer first name"},
    {"name": "destinatario", "description": "Name of the person the song is for"},
    {"name": "checkout_url", "description": "Checkout URL to complete payment"}
  ]'::jsonb
) ON CONFLICT (template_type, language) DO UPDATE SET
  message_text = EXCLUDED.message_text,
  button_configs = EXCLUDED.button_configs,
  variables = EXCLUDED.variables,
  updated_at = NOW();

-- checkout_reminder (ES)
INSERT INTO whatsapp_templates_i18n (template_type, language, message_text, button_configs, variables)
VALUES (
  'checkout_reminder',
  'es',
  '¡Hola {first_name}! 👋

¡Tu canción personalizada para {destinatario} está casi lista y suena increíble! 🎵

Imagina la reacción cuando {destinatario} escuche una canción hecha especialmente para él/ella...

✨ Un momento único que quedará en la memoria para siempre
💝 Un regalo que muestra cuánto te importa
🎶 Una historia de amor contada en música

Estamos aquí para hacer este momento aún más especial. Solo completa tu pedido y en 24h recibirás tu canción lista! ⚡

💛 No dejes pasar esta oportunidad - ¡{destinatario} lo va a amar!',
  '{
    "buttons": [
      {
        "id": "checkout",
        "text": "🚀 Completar Ahora",
        "type": "url",
        "url_template": "{checkout_url}"
      }
    ]
  }'::jsonb,
  '[
    {"name": "first_name", "description": "Nombre del cliente"},
    {"name": "destinatario", "description": "Nombre de la persona para quien es la canción"},
    {"name": "checkout_url", "description": "URL del checkout para completar el pago"}
  ]'::jsonb
) ON CONFLICT (template_type, language) DO UPDATE SET
  message_text = EXCLUDED.message_text,
  button_configs = EXCLUDED.button_configs,
  variables = EXCLUDED.variables,
  updated_at = NOW();

-- ==========================================
-- TEMPLATE: follow_up_1
-- ==========================================

-- follow_up_1 (PT)
INSERT INTO whatsapp_templates_i18n (template_type, language, message_text, button_configs, variables)
VALUES (
  'follow_up_1',
  'pt',
  '{first_name}, só passando aqui para lembrar! 😊

Sua música para {destinatario} está esperando por você!

Sabemos que você quer criar algo especial, e estamos aqui para ajudar nisso.

💝 É um presente único que {destinatario} nunca vai esquecer
✨ Uma forma diferente e emocionante de expressar seus sentimentos
🎵 Uma canção que vai tocar o coração de quem você ama

Está tudo pronto do nosso lado - é só você finalizar e em até 24h sua música estará pronta! ⚡

💛 Que tal fazer isso agora? É rápido e fácil!',
  '{
    "buttons": [
      {
        "id": "checkout",
        "text": "🚀 Finalizar Agora",
        "type": "url",
        "url_template": "{checkout_url}"
      }
    ]
  }'::jsonb,
  '[
    {"name": "first_name", "description": "Primeiro nome do cliente"},
    {"name": "destinatario", "description": "Nome da pessoa para quem é a música"},
    {"name": "checkout_url", "description": "URL do checkout para finalizar pagamento"}
  ]'::jsonb
) ON CONFLICT (template_type, language) DO UPDATE SET
  message_text = EXCLUDED.message_text,
  button_configs = EXCLUDED.button_configs,
  variables = EXCLUDED.variables,
  updated_at = NOW();

-- follow_up_1 (EN)
INSERT INTO whatsapp_templates_i18n (template_type, language, message_text, button_configs, variables)
VALUES (
  'follow_up_1',
  'en',
  '{first_name}, just stopping by to remind you! 😊

Your song for {destinatario} is waiting for you!

We know you want to create something special, and we''re here to help with that.

💝 It''s a unique gift that {destinatario} will never forget
✨ A different and exciting way to express your feelings
🎵 A song that will touch the heart of someone you love

Everything is ready on our end - just complete your order and within 24h your song will be ready! ⚡

💛 How about doing it now? It''s quick and easy!',
  '{
    "buttons": [
      {
        "id": "checkout",
        "text": "🚀 Complete Now",
        "type": "url",
        "url_template": "{checkout_url}"
      }
    ]
  }'::jsonb,
  '[
    {"name": "first_name", "description": "Customer first name"},
    {"name": "destinatario", "description": "Name of the person the song is for"},
    {"name": "checkout_url", "description": "Checkout URL to complete payment"}
  ]'::jsonb
) ON CONFLICT (template_type, language) DO UPDATE SET
  message_text = EXCLUDED.message_text,
  button_configs = EXCLUDED.button_configs,
  variables = EXCLUDED.variables,
  updated_at = NOW();

-- follow_up_1 (ES)
INSERT INTO whatsapp_templates_i18n (template_type, language, message_text, button_configs, variables)
VALUES (
  'follow_up_1',
  'es',
  '{first_name}, solo pasando para recordarte! 😊

¡Tu canción para {destinatario} te está esperando!

Sabemos que quieres crear algo especial, y estamos aquí para ayudarte con eso.

💝 Es un regalo único que {destinatario} nunca olvidará
✨ Una forma diferente y emocionante de expresar tus sentimientos
🎵 Una canción que tocará el corazón de quien amas

Todo está listo de nuestro lado - solo completa tu pedido y en 24h tu canción estará lista! ⚡

💛 ¿Qué tal hacerlo ahora? ¡Es rápido y fácil!',
  '{
    "buttons": [
      {
        "id": "checkout",
        "text": "🚀 Completar Ahora",
        "type": "url",
        "url_template": "{checkout_url}"
      }
    ]
  }'::jsonb,
  '[
    {"name": "first_name", "description": "Nombre del cliente"},
    {"name": "destinatario", "description": "Nombre de la persona para quien es la canción"},
    {"name": "checkout_url", "description": "URL del checkout para completar el pago"}
  ]'::jsonb
) ON CONFLICT (template_type, language) DO UPDATE SET
  message_text = EXCLUDED.message_text,
  button_configs = EXCLUDED.button_configs,
  variables = EXCLUDED.variables,
  updated_at = NOW();

-- ==========================================
-- TEMPLATE: follow_up_2
-- ==========================================

-- follow_up_2 (PT)
INSERT INTO whatsapp_templates_i18n (template_type, language, message_text, button_configs, variables)
VALUES (
  'follow_up_2',
  'pt',
  'Oi {first_name}! 👋

Ainda pensando? Não se preocupe, entendemos! 😊

Mas queremos te lembrar que mais de {total_customers} pessoas já criaram músicas incríveis para pessoas especiais.

E todas elas disseram a mesma coisa: "Valeu cada centavo!"

💝 {destinatario} merece esse presente único
🎵 Uma canção feita especialmente para ele(a)
✨ Um momento que vai ficar na memória para sempre

É só finalizar agora e em até 24h sua música estará pronta! ⚡

💛 Não deixe {destinatario} esperando mais!',
  '{
    "buttons": [
      {
        "id": "checkout",
        "text": "🚀 Finalizar Agora",
        "type": "url",
        "url_template": "{checkout_url}"
      }
    ]
  }'::jsonb,
  '[
    {"name": "first_name", "description": "Primeiro nome do cliente"},
    {"name": "destinatario", "description": "Nome da pessoa para quem é a música"},
    {"name": "total_customers", "description": "Número total de clientes"},
    {"name": "checkout_url", "description": "URL do checkout para finalizar pagamento"}
  ]'::jsonb
) ON CONFLICT (template_type, language) DO UPDATE SET
  message_text = EXCLUDED.message_text,
  button_configs = EXCLUDED.button_configs,
  variables = EXCLUDED.variables,
  updated_at = NOW();

-- follow_up_2 (EN)
INSERT INTO whatsapp_templates_i18n (template_type, language, message_text, button_configs, variables)
VALUES (
  'follow_up_2',
  'en',
  'Hi {first_name}! 👋

Still thinking? Don''t worry, we understand! 😊

But we want to remind you that more than {total_customers} people have already created amazing songs for special people.

And they all said the same thing: "It was worth every penny!"

💝 {destinatario} deserves this unique gift
🎵 A song made especially for them
✨ A moment that will last forever in memory

Just complete now and within 24h your song will be ready! ⚡

💛 Don''t keep {destinatario} waiting any longer!',
  '{
    "buttons": [
      {
        "id": "checkout",
        "text": "🚀 Complete Now",
        "type": "url",
        "url_template": "{checkout_url}"
      }
    ]
  }'::jsonb,
  '[
    {"name": "first_name", "description": "Customer first name"},
    {"name": "destinatario", "description": "Name of the person the song is for"},
    {"name": "total_customers", "description": "Total number of customers"},
    {"name": "checkout_url", "description": "Checkout URL to complete payment"}
  ]'::jsonb
) ON CONFLICT (template_type, language) DO UPDATE SET
  message_text = EXCLUDED.message_text,
  button_configs = EXCLUDED.button_configs,
  variables = EXCLUDED.variables,
  updated_at = NOW();

-- follow_up_2 (ES)
INSERT INTO whatsapp_templates_i18n (template_type, language, message_text, button_configs, variables)
VALUES (
  'follow_up_2',
  'es',
  '¡Hola {first_name}! 👋

¿Todavía pensando? ¡No te preocupes, entendemos! 😊

Pero queremos recordarte que más de {total_customers} personas ya han creado canciones increíbles para personas especiales.

Y todas dijeron lo mismo: "¡Valió cada centavo!"

💝 {destinatario} merece este regalo único
🎵 Una canción hecha especialmente para él/ella
✨ Un momento que quedará en la memoria para siempre

Solo completa ahora y en 24h tu canción estará lista! ⚡

💛 ¡No dejes a {destinatario} esperando más!',
  '{
    "buttons": [
      {
        "id": "checkout",
        "text": "🚀 Completar Ahora",
        "type": "url",
        "url_template": "{checkout_url}"
      }
    ]
  }'::jsonb,
  '[
    {"name": "first_name", "description": "Nombre del cliente"},
    {"name": "destinatario", "description": "Nombre de la persona para quien es la canción"},
    {"name": "total_customers", "description": "Número total de clientes"},
    {"name": "checkout_url", "description": "URL del checkout para completar el pago"}
  ]'::jsonb
) ON CONFLICT (template_type, language) DO UPDATE SET
  message_text = EXCLUDED.message_text,
  button_configs = EXCLUDED.button_configs,
  variables = EXCLUDED.variables,
  updated_at = NOW();

-- ==========================================
-- TEMPLATE: follow_up_3
-- ==========================================

-- follow_up_3 (PT)
INSERT INTO whatsapp_templates_i18n (template_type, language, message_text, button_configs, variables)
VALUES (
  'follow_up_3',
  'pt',
  'Oi {first_name}! 👋

Esta é nossa última mensagem sobre sua música para {destinatario}.

Sabemos que a vida é corrida e às vezes as coisas ficam para depois. Mas este presente é especial demais para deixar passar.

💝 Uma música personalizada que {destinatario} nunca vai esquecer
🎵 Feita especialmente para ele(a), com todo carinho
✨ Um momento único que vai tocar o coração

É sua última chance de criar algo realmente especial. Em até 24h sua música estará pronta! ⚡

💛 Não deixe essa oportunidade única passar!',
  '{
    "buttons": [
      {
        "id": "checkout",
        "text": "🚀 Finalizar Agora",
        "type": "url",
        "url_template": "{checkout_url}"
      }
    ]
  }'::jsonb,
  '[
    {"name": "first_name", "description": "Primeiro nome do cliente"},
    {"name": "destinatario", "description": "Nome da pessoa para quem é a música"},
    {"name": "checkout_url", "description": "URL do checkout para finalizar pagamento"}
  ]'::jsonb
) ON CONFLICT (template_type, language) DO UPDATE SET
  message_text = EXCLUDED.message_text,
  button_configs = EXCLUDED.button_configs,
  variables = EXCLUDED.variables,
  updated_at = NOW();

-- follow_up_3 (EN)
INSERT INTO whatsapp_templates_i18n (template_type, language, message_text, button_configs, variables)
VALUES (
  'follow_up_3',
  'en',
  'Hi {first_name}! 👋

This is our last message about your song for {destinatario}.

We know life is busy and sometimes things get put off. But this gift is too special to let pass.

💝 A personalized song that {destinatario} will never forget
🎵 Made especially for them, with all care
✨ A unique moment that will touch the heart

This is your last chance to create something truly special. Within 24h your song will be ready! ⚡

💛 Don''t let this unique opportunity pass!',
  '{
    "buttons": [
      {
        "id": "checkout",
        "text": "🚀 Complete Now",
        "type": "url",
        "url_template": "{checkout_url}"
      }
    ]
  }'::jsonb,
  '[
    {"name": "first_name", "description": "Customer first name"},
    {"name": "destinatario", "description": "Name of the person the song is for"},
    {"name": "checkout_url", "description": "Checkout URL to complete payment"}
  ]'::jsonb
) ON CONFLICT (template_type, language) DO UPDATE SET
  message_text = EXCLUDED.message_text,
  button_configs = EXCLUDED.button_configs,
  variables = EXCLUDED.variables,
  updated_at = NOW();

-- follow_up_3 (ES)
INSERT INTO whatsapp_templates_i18n (template_type, language, message_text, button_configs, variables)
VALUES (
  'follow_up_3',
  'es',
  '¡Hola {first_name}! 👋

Este es nuestro último mensaje sobre tu canción para {destinatario}.

Sabemos que la vida es ajetreada y a veces las cosas se dejan para después. Pero este regalo es demasiado especial para dejarlo pasar.

💝 Una canción personalizada que {destinatario} nunca olvidará
🎵 Hecha especialmente para él/ella, con todo cariño
✨ Un momento único que tocará el corazón

Es tu última oportunidad de crear algo realmente especial. En 24h tu canción estará lista! ⚡

💛 ¡No dejes pasar esta oportunidad única!',
  '{
    "buttons": [
      {
        "id": "checkout",
        "text": "🚀 Completar Ahora",
        "type": "url",
        "url_template": "{checkout_url}"
      }
    ]
  }'::jsonb,
  '[
    {"name": "first_name", "description": "Nombre del cliente"},
    {"name": "destinatario", "description": "Nombre de la persona para quien es la canción"},
    {"name": "checkout_url", "description": "URL del checkout para completar el pago"}
  ]'::jsonb
) ON CONFLICT (template_type, language) DO UPDATE SET
  message_text = EXCLUDED.message_text,
  button_configs = EXCLUDED.button_configs,
  variables = EXCLUDED.variables,
  updated_at = NOW();

-- ==========================================
-- TEMPLATE: order_paid
-- ==========================================

-- order_paid (PT)
INSERT INTO whatsapp_templates_i18n (template_type, language, message_text, button_configs, variables)
VALUES (
  'order_paid',
  'pt',
  'Olá {first_name}, obrigado! 🙏💙

🎉 Seu pagamento foi confirmado!

✨ Já estamos criando algo especial para {destinatario}

📋 *Detalhes do Pedido:*
🆔 Número: {order_number}
🎸 Estilo: {style}
⏰ Plano: {plan}
📅 Previsão de entrega: {delivery_time}
🗓️ Data de lançamento: {release_date}

🎵 Nossa equipe está trabalhando com muito carinho
💝 Vai ser inesquecível!

Obrigado por confiar na Music Lovely! 💛',
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
) ON CONFLICT (template_type, language) DO UPDATE SET
  message_text = EXCLUDED.message_text,
  button_configs = EXCLUDED.button_configs,
  variables = EXCLUDED.variables,
  updated_at = NOW();

-- order_paid (EN)
INSERT INTO whatsapp_templates_i18n (template_type, language, message_text, button_configs, variables)
VALUES (
  'order_paid',
  'en',
  'Hello {first_name}, thank you! 🙏💙

🎉 Your payment has been confirmed!

✨ We are already creating something special for {destinatario}

📋 *Order Details:*
🆔 Number: {order_number}
🎸 Style: {style}
⏰ Plan: {plan}
📅 Estimated delivery: {delivery_time}
🗓️ Release date: {release_date}

🎵 Our team is working with great care
💝 It will be unforgettable!

Thank you for trusting Music Lovely! 💛',
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
) ON CONFLICT (template_type, language) DO UPDATE SET
  message_text = EXCLUDED.message_text,
  button_configs = EXCLUDED.button_configs,
  variables = EXCLUDED.variables,
  updated_at = NOW();

-- order_paid (ES)
INSERT INTO whatsapp_templates_i18n (template_type, language, message_text, button_configs, variables)
VALUES (
  'order_paid',
  'es',
  '¡Hola {first_name}, gracias! 🙏💙

🎉 ¡Tu pago ha sido confirmado!

✨ Ya estamos creando algo especial para {destinatario}

📋 *Detalles del Pedido:*
🆔 Número: {order_number}
🎸 Estilo: {style}
⏰ Plan: {plan}
📅 Tiempo de entrega: {delivery_time}
🗓️ Fecha de lanzamiento: {release_date}

🎵 Nuestro equipo está trabajando con mucho cuidado
💝 ¡Será inolvidable!

¡Gracias por confiar en Music Lovely! 💛',
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
) ON CONFLICT (template_type, language) DO UPDATE SET
  message_text = EXCLUDED.message_text,
  button_configs = EXCLUDED.button_configs,
  variables = EXCLUDED.variables,
  updated_at = NOW();

