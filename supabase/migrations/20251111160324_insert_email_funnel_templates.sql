-- ==========================================
-- Inserir Templates de Email para Funil
-- Templates para checkout_reminder, follow_up_1, follow_up_2, follow_up_3
-- ==========================================

-- Template: checkout_reminder (PT) - Primeira mensagem (7 minutos)
INSERT INTO email_templates_i18n (template_type, language, subject, html_content, variables, from_name, from_email, reply_to)
VALUES (
  'checkout_reminder',
  'pt',
  'Sua música personalizada está quase pronta! 🎵',
  '<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sua música está quase pronta</title>
  <style>
    body { margin: 0; padding: 0; background: #F6F1EA; color: #2E2B27; font-family: Inter, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
    .wrapper { width: 100%; background: #F6F1EA; padding: 24px 0; }
    .container { width: 100%; max-width: 620px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; box-shadow: 0 2px 14px rgba(0,0,0,0.08); overflow: hidden; }
    .header { padding: 20px; text-align: center; color: #FFFFFF; background: linear-gradient(135deg, #FFF9F5 0%, #C7855E 50%, #B07954 100%); }
    .content { padding: 36px 30px; line-height: 1.6; }
    .content h2 { margin: 0 0 10px; font-size: 26px; color: #2E2B27; }
    .content p { margin: 0 0 18px; font-size: 16px; color: #2E2B27; }
    .button { display: inline-block; padding: 14px 32px; background: #C7855E; color: #FFFFFF; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .button:hover { background: #B07954; }
    .footer { text-align: center; font-size: 13px; color: #6B6157; padding: 24px; background: #FFF9F5; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1 style="margin: 0; color: #FFFFFF;">🎵 Music Lovely</h1>
      </div>
      <div class="content">
        <h2>Oi {{first_name}}! 👋</h2>
        <p>Sua música personalizada para <strong>{{destinatario}}</strong> está quase pronta e ficou incrível! 🎵</p>
        <p>Imagina a reação quando <strong>{{destinatario}}</strong> ouvir uma canção feita especialmente para ele(a)...</p>
        <ul style="margin: 20px 0; padding-left: 20px;">
          <li>✨ Um momento único que vai ficar na memória para sempre</li>
          <li>💝 Um presente que mostra o quanto você se importa</li>
          <li>🎶 Uma história de amor contada em música</li>
        </ul>
        <p>Estamos aqui para tornar esse momento ainda mais especial. É só finalizar e em até 24h você recebe sua música pronta! ⚡</p>
        <div style="text-align: center;">
          <a href="{{checkout_url}}" class="button">🚀 Finalizar Agora</a>
        </div>
        <p style="margin-top: 30px; color: #6B6157; font-size: 14px;">💛 Não deixe essa oportunidade passar - <strong>{{destinatario}}</strong> vai adorar!</p>
      </div>
      <div class="footer">
        <p>© 2025 Music Lovely — <a href="https://musiclovely.com" style="color:#C7855E;">musiclovely.com</a></p>
      </div>
    </div>
  </div>
</body>
</html>',
  '[{"name": "first_name", "description": "Primeiro nome do cliente"}, {"name": "destinatario", "description": "Nome da pessoa para quem é a música"}, {"name": "checkout_url", "description": "URL do checkout para finalizar pagamento"}]'::jsonb,
  'Music Lovely',
  'no-reply@musiclovely.com',
  'no-reply@musiclovely.com'
) ON CONFLICT (template_type, language) DO UPDATE SET
  subject = EXCLUDED.subject,
  html_content = EXCLUDED.html_content,
  variables = EXCLUDED.variables,
  updated_at = NOW();

-- Template: checkout_reminder (EN)
INSERT INTO email_templates_i18n (template_type, language, subject, html_content, variables, from_name, from_email, reply_to)
VALUES (
  'checkout_reminder',
  'en',
  'Your personalized song is almost ready! 🎵',
  '<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your song is almost ready</title>
  <style>
    body { margin: 0; padding: 0; background: #F6F1EA; color: #2E2B27; font-family: Inter, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
    .wrapper { width: 100%; background: #F6F1EA; padding: 24px 0; }
    .container { width: 100%; max-width: 620px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; box-shadow: 0 2px 14px rgba(0,0,0,0.08); overflow: hidden; }
    .header { padding: 20px; text-align: center; color: #FFFFFF; background: linear-gradient(135deg, #FFF9F5 0%, #C7855E 50%, #B07954 100%); }
    .content { padding: 36px 30px; line-height: 1.6; }
    .content h2 { margin: 0 0 10px; font-size: 26px; color: #2E2B27; }
    .content p { margin: 0 0 18px; font-size: 16px; color: #2E2B27; }
    .button { display: inline-block; padding: 14px 32px; background: #C7855E; color: #FFFFFF; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .button:hover { background: #B07954; }
    .footer { text-align: center; font-size: 13px; color: #6B6157; padding: 24px; background: #FFF9F5; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1 style="margin: 0; color: #FFFFFF;">🎵 Music Lovely</h1>
      </div>
      <div class="content">
        <h2>Hi {{first_name}}! 👋</h2>
        <p>Your personalized song for <strong>{{destinatario}}</strong> is almost ready and it sounds amazing! 🎵</p>
        <p>Imagine the reaction when <strong>{{destinatario}}</strong> hears a song made especially for them...</p>
        <ul style="margin: 20px 0; padding-left: 20px;">
          <li>✨ A unique moment that will last forever in memory</li>
          <li>💝 A gift that shows how much you care</li>
          <li>🎶 A love story told through music</li>
        </ul>
        <p>We''re here to make this moment even more special. Just complete your order and within 24h you''ll receive your ready song! ⚡</p>
        <div style="text-align: center;">
          <a href="{{checkout_url}}" class="button">🚀 Complete Now</a>
        </div>
        <p style="margin-top: 30px; color: #6B6157; font-size: 14px;">💛 Don''t let this opportunity pass - <strong>{{destinatario}}</strong> will love it!</p>
      </div>
      <div class="footer">
        <p>© 2025 Music Lovely — <a href="https://musiclovely.com" style="color:#C7855E;">musiclovely.com</a></p>
      </div>
    </div>
  </div>
</body>
</html>',
  '[{"name": "first_name", "description": "Customer first name"}, {"name": "destinatario", "description": "Name of the person the song is for"}, {"name": "checkout_url", "description": "Checkout URL to complete payment"}]'::jsonb,
  'Music Lovely',
  'no-reply@musiclovely.com',
  'no-reply@musiclovely.com'
) ON CONFLICT (template_type, language) DO UPDATE SET
  subject = EXCLUDED.subject,
  html_content = EXCLUDED.html_content,
  variables = EXCLUDED.variables,
  updated_at = NOW();

-- Template: checkout_reminder (ES)
INSERT INTO email_templates_i18n (template_type, language, subject, html_content, variables, from_name, from_email, reply_to)
VALUES (
  'checkout_reminder',
  'es',
  '¡Tu canción personalizada está casi lista! 🎵',
  '<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tu canción está casi lista</title>
  <style>
    body { margin: 0; padding: 0; background: #F6F1EA; color: #2E2B27; font-family: Inter, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
    .wrapper { width: 100%; background: #F6F1EA; padding: 24px 0; }
    .container { width: 100%; max-width: 620px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; box-shadow: 0 2px 14px rgba(0,0,0,0.08); overflow: hidden; }
    .header { padding: 20px; text-align: center; color: #FFFFFF; background: linear-gradient(135deg, #FFF9F5 0%, #C7855E 50%, #B07954 100%); }
    .content { padding: 36px 30px; line-height: 1.6; }
    .content h2 { margin: 0 0 10px; font-size: 26px; color: #2E2B27; }
    .content p { margin: 0 0 18px; font-size: 16px; color: #2E2B27; }
    .button { display: inline-block; padding: 14px 32px; background: #C7855E; color: #FFFFFF; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .button:hover { background: #B07954; }
    .footer { text-align: center; font-size: 13px; color: #6B6157; padding: 24px; background: #FFF9F5; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1 style="margin: 0; color: #FFFFFF;">🎵 Music Lovely</h1>
      </div>
      <div class="content">
        <h2>¡Hola {{first_name}}! 👋</h2>
        <p>¡Tu canción personalizada para <strong>{{destinatario}}</strong> está casi lista y suena increíble! 🎵</p>
        <p>Imagina la reacción cuando <strong>{{destinatario}}</strong> escuche una canción hecha especialmente para él/ella...</p>
        <ul style="margin: 20px 0; padding-left: 20px;">
          <li>✨ Un momento único que quedará en la memoria para siempre</li>
          <li>💝 Un regalo que muestra cuánto te importa</li>
          <li>🎶 Una historia de amor contada en música</li>
        </ul>
        <p>Estamos aquí para hacer este momento aún más especial. Solo completa tu pedido y en 24h recibirás tu canción lista! ⚡</p>
        <div style="text-align: center;">
          <a href="{{checkout_url}}" class="button">🚀 Completar Ahora</a>
        </div>
        <p style="margin-top: 30px; color: #6B6157; font-size: 14px;">💛 No dejes pasar esta oportunidad - ¡<strong>{{destinatario}}</strong> lo va a amar!</p>
      </div>
      <div class="footer">
        <p>© 2025 Music Lovely — <a href="https://musiclovely.com" style="color:#C7855E;">musiclovely.com</a></p>
      </div>
    </div>
  </div>
</body>
</html>',
  '[{"name": "first_name", "description": "Nombre del cliente"}, {"name": "destinatario", "description": "Nombre de la persona para quien es la canción"}, {"name": "checkout_url", "description": "URL del checkout para completar el pago"}]'::jsonb,
  'Music Lovely',
  'no-reply@musiclovely.com',
  'no-reply@musiclovely.com'
) ON CONFLICT (template_type, language) DO UPDATE SET
  subject = EXCLUDED.subject,
  html_content = EXCLUDED.html_content,
  variables = EXCLUDED.variables,
  updated_at = NOW();

-- Template: follow_up_1 (PT) - Segunda mensagem (20 minutos)
INSERT INTO email_templates_i18n (template_type, language, subject, html_content, variables, from_name, from_email, reply_to)
VALUES (
  'follow_up_1',
  'pt',
  'Sua música para {{destinatario}} está esperando por você! 😊',
  '<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sua música está esperando</title>
  <style>
    body { margin: 0; padding: 0; background: #F6F1EA; color: #2E2B27; font-family: Inter, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
    .wrapper { width: 100%; background: #F6F1EA; padding: 24px 0; }
    .container { width: 100%; max-width: 620px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; box-shadow: 0 2px 14px rgba(0,0,0,0.08); overflow: hidden; }
    .header { padding: 20px; text-align: center; color: #FFFFFF; background: linear-gradient(135deg, #FFF9F5 0%, #C7855E 50%, #B07954 100%); }
    .content { padding: 36px 30px; line-height: 1.6; }
    .content h2 { margin: 0 0 10px; font-size: 26px; color: #2E2B27; }
    .content p { margin: 0 0 18px; font-size: 16px; color: #2E2B27; }
    .button { display: inline-block; padding: 14px 32px; background: #C7855E; color: #FFFFFF; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .button:hover { background: #B07954; }
    .footer { text-align: center; font-size: 13px; color: #6B6157; padding: 24px; background: #FFF9F5; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1 style="margin: 0; color: #FFFFFF;">🎵 Music Lovely</h1>
      </div>
      <div class="content">
        <h2>{{first_name}}, só passando aqui para lembrar! 😊</h2>
        <p>Sua música para <strong>{{destinatario}}</strong> está esperando por você!</p>
        <p>Sabemos que você quer criar algo especial, e estamos aqui para ajudar nisso.</p>
        <ul style="margin: 20px 0; padding-left: 20px;">
          <li>💝 É um presente único que <strong>{{destinatario}}</strong> nunca vai esquecer</li>
          <li>✨ Uma forma diferente e emocionante de expressar seus sentimentos</li>
          <li>🎵 Uma canção que vai tocar o coração de quem você ama</li>
        </ul>
        <p>Está tudo pronto do nosso lado - é só você finalizar e em até 24h sua música estará pronta! ⚡</p>
        <div style="text-align: center;">
          <a href="{{checkout_url}}" class="button">🚀 Finalizar Agora</a>
        </div>
        <p style="margin-top: 30px; color: #6B6157; font-size: 14px;">💛 Que tal fazer isso agora? É rápido e fácil!</p>
      </div>
      <div class="footer">
        <p>© 2025 Music Lovely — <a href="https://musiclovely.com" style="color:#C7855E;">musiclovely.com</a></p>
      </div>
    </div>
  </div>
</body>
</html>',
  '[{"name": "first_name", "description": "Primeiro nome do cliente"}, {"name": "destinatario", "description": "Nome da pessoa para quem é a música"}, {"name": "checkout_url", "description": "URL do checkout para finalizar pagamento"}]'::jsonb,
  'Music Lovely',
  'no-reply@musiclovely.com',
  'no-reply@musiclovely.com'
) ON CONFLICT (template_type, language) DO UPDATE SET
  subject = EXCLUDED.subject,
  html_content = EXCLUDED.html_content,
  variables = EXCLUDED.variables,
  updated_at = NOW();

-- Template: follow_up_1 (EN)
INSERT INTO email_templates_i18n (template_type, language, subject, html_content, variables, from_name, from_email, reply_to)
VALUES (
  'follow_up_1',
  'en',
  'Your song for {{destinatario}} is waiting for you! 😊',
  '<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your song is waiting</title>
  <style>
    body { margin: 0; padding: 0; background: #F6F1EA; color: #2E2B27; font-family: Inter, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
    .wrapper { width: 100%; background: #F6F1EA; padding: 24px 0; }
    .container { width: 100%; max-width: 620px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; box-shadow: 0 2px 14px rgba(0,0,0,0.08); overflow: hidden; }
    .header { padding: 20px; text-align: center; color: #FFFFFF; background: linear-gradient(135deg, #FFF9F5 0%, #C7855E 50%, #B07954 100%); }
    .content { padding: 36px 30px; line-height: 1.6; }
    .content h2 { margin: 0 0 10px; font-size: 26px; color: #2E2B27; }
    .content p { margin: 0 0 18px; font-size: 16px; color: #2E2B27; }
    .button { display: inline-block; padding: 14px 32px; background: #C7855E; color: #FFFFFF; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .button:hover { background: #B07954; }
    .footer { text-align: center; font-size: 13px; color: #6B6157; padding: 24px; background: #FFF9F5; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1 style="margin: 0; color: #FFFFFF;">🎵 Music Lovely</h1>
      </div>
      <div class="content">
        <h2>{{first_name}}, just stopping by to remind you! 😊</h2>
        <p>Your song for <strong>{{destinatario}}</strong> is waiting for you!</p>
        <p>We know you want to create something special, and we''re here to help with that.</p>
        <ul style="margin: 20px 0; padding-left: 20px;">
          <li>💝 It''s a unique gift that <strong>{{destinatario}}</strong> will never forget</li>
          <li>✨ A different and exciting way to express your feelings</li>
          <li>🎵 A song that will touch the heart of someone you love</li>
        </ul>
        <p>Everything is ready on our end - just complete your order and within 24h your song will be ready! ⚡</p>
        <div style="text-align: center;">
          <a href="{{checkout_url}}" class="button">🚀 Complete Now</a>
        </div>
        <p style="margin-top: 30px; color: #6B6157; font-size: 14px;">💛 How about doing that now? It''s quick and easy!</p>
      </div>
      <div class="footer">
        <p>© 2025 Music Lovely — <a href="https://musiclovely.com" style="color:#C7855E;">musiclovely.com</a></p>
      </div>
    </div>
  </div>
</body>
</html>',
  '[{"name": "first_name", "description": "Customer first name"}, {"name": "destinatario", "description": "Name of the person the song is for"}, {"name": "checkout_url", "description": "Checkout URL to complete payment"}]'::jsonb,
  'Music Lovely',
  'no-reply@musiclovely.com',
  'no-reply@musiclovely.com'
) ON CONFLICT (template_type, language) DO UPDATE SET
  subject = EXCLUDED.subject,
  html_content = EXCLUDED.html_content,
  variables = EXCLUDED.variables,
  updated_at = NOW();

-- Template: follow_up_1 (ES)
INSERT INTO email_templates_i18n (template_type, language, subject, html_content, variables, from_name, from_email, reply_to)
VALUES (
  'follow_up_1',
  'es',
  '¡Tu canción para {{destinatario}} te está esperando! 😊',
  '<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tu canción te está esperando</title>
  <style>
    body { margin: 0; padding: 0; background: #F6F1EA; color: #2E2B27; font-family: Inter, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
    .wrapper { width: 100%; background: #F6F1EA; padding: 24px 0; }
    .container { width: 100%; max-width: 620px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; box-shadow: 0 2px 14px rgba(0,0,0,0.08); overflow: hidden; }
    .header { padding: 20px; text-align: center; color: #FFFFFF; background: linear-gradient(135deg, #FFF9F5 0%, #C7855E 50%, #B07954 100%); }
    .content { padding: 36px 30px; line-height: 1.6; }
    .content h2 { margin: 0 0 10px; font-size: 26px; color: #2E2B27; }
    .content p { margin: 0 0 18px; font-size: 16px; color: #2E2B27; }
    .button { display: inline-block; padding: 14px 32px; background: #C7855E; color: #FFFFFF; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .button:hover { background: #B07954; }
    .footer { text-align: center; font-size: 13px; color: #6B6157; padding: 24px; background: #FFF9F5; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1 style="margin: 0; color: #FFFFFF;">🎵 Music Lovely</h1>
      </div>
      <div class="content">
        <h2>{{first_name}}, solo pasando para recordarte! 😊</h2>
        <p>¡Tu canción para <strong>{{destinatario}}</strong> te está esperando!</p>
        <p>Sabemos que quieres crear algo especial, y estamos aquí para ayudarte con eso.</p>
        <ul style="margin: 20px 0; padding-left: 20px;">
          <li>💝 Es un regalo único que <strong>{{destinatario}}</strong> nunca olvidará</li>
          <li>✨ Una forma diferente y emocionante de expresar tus sentimientos</li>
          <li>🎵 Una canción que tocará el corazón de quien amas</li>
        </ul>
        <p>Todo está listo de nuestro lado - solo completa tu pedido y en 24h tu canción estará lista! ⚡</p>
        <div style="text-align: center;">
          <a href="{{checkout_url}}" class="button">🚀 Completar Ahora</a>
        </div>
        <p style="margin-top: 30px; color: #6B6157; font-size: 14px;">💛 ¿Qué tal hacerlo ahora? ¡Es rápido y fácil!</p>
      </div>
      <div class="footer">
        <p>© 2025 Music Lovely — <a href="https://musiclovely.com" style="color:#C7855E;">musiclovely.com</a></p>
      </div>
    </div>
  </div>
</body>
</html>',
  '[{"name": "first_name", "description": "Nombre del cliente"}, {"name": "destinatario", "description": "Nombre de la persona para quien es la canción"}, {"name": "checkout_url", "description": "URL del checkout para completar el pago"}]'::jsonb,
  'Music Lovely',
  'no-reply@musiclovely.com',
  'no-reply@musiclovely.com'
) ON CONFLICT (template_type, language) DO UPDATE SET
  subject = EXCLUDED.subject,
  html_content = EXCLUDED.html_content,
  variables = EXCLUDED.variables,
  updated_at = NOW();

-- Template: follow_up_2 (PT) - Terceira mensagem (1 hora) - com desconto
INSERT INTO email_templates_i18n (template_type, language, subject, html_content, variables, from_name, from_email, reply_to)
VALUES (
  'follow_up_2',
  'pt',
  'Presente especial: 10% OFF na sua música! 🎁',
  '<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Presente Especial - 10% OFF</title>
  <style>
    body { margin: 0; padding: 0; background: #F6F1EA; color: #2E2B27; font-family: Inter, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
    .wrapper { width: 100%; background: #F6F1EA; padding: 24px 0; }
    .container { width: 100%; max-width: 620px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; box-shadow: 0 2px 14px rgba(0,0,0,0.08); overflow: hidden; }
    .header { padding: 20px; text-align: center; color: #FFFFFF; background: linear-gradient(135deg, #FFF9F5 0%, #C7855E 50%, #B07954 100%); }
    .content { padding: 36px 30px; line-height: 1.6; }
    .content h2 { margin: 0 0 10px; font-size: 26px; color: #2E2B27; }
    .content p { margin: 0 0 18px; font-size: 16px; color: #2E2B27; }
    .discount-box { background: #FFF9F5; border: 2px solid #C7855E; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center; }
    .discount-code { font-size: 24px; font-weight: bold; color: #C7855E; margin: 10px 0; }
    .button { display: inline-block; padding: 14px 32px; background: #C7855E; color: #FFFFFF; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .button:hover { background: #B07954; }
    .footer { text-align: center; font-size: 13px; color: #6B6157; padding: 24px; background: #FFF9F5; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1 style="margin: 0; color: #FFFFFF;">🎵 Music Lovely</h1>
      </div>
      <div class="content">
        <h2>{{first_name}}, imagina o sorriso no rosto de {{destinatario}}... 😍</h2>
        <p>Mais de <strong>{{total_customers}}</strong> pessoas já criaram momentos inesquecíveis com a gente, e cada uma delas ficou emocionada com o resultado.</p>
        <ul style="margin: 20px 0; padding-left: 20px;">
          <li>💕 É realmente algo especial ver a reação de quem recebe</li>
          <li>✨ Uma memória que vai durar para sempre</li>
          <li>🎵 Uma forma única de dizer "eu te amo"</li>
        </ul>
        <div class="discount-box">
          <p style="margin: 0 0 10px; font-size: 18px; font-weight: 600;">🎁 Presente Especial para Você:</p>
          <div class="discount-code">10% OFF com o código CANTA10</div>
          <p style="margin: 10px 0 0; font-size: 14px; color: #6B6157;">É nossa forma de dizer que você está fazendo uma escolha incrível! 💛</p>
        </div>
        <div style="text-align: center;">
          <a href="{{checkout_url}}" class="button">🚀 Finalizar Agora com Desconto</a>
        </div>
        <p style="margin-top: 30px; color: #6B6157; font-size: 14px;">Garanta esse momento único para <strong>{{destinatario}}</strong>!</p>
      </div>
      <div class="footer">
        <p>© 2025 Music Lovely — <a href="https://musiclovely.com" style="color:#C7855E;">musiclovely.com</a></p>
      </div>
    </div>
  </div>
</body>
</html>',
  '[{"name": "first_name", "description": "Primeiro nome do cliente"}, {"name": "destinatario", "description": "Nome da pessoa para quem é a música"}, {"name": "total_customers", "description": "Número total de clientes (ex: 1000)"}, {"name": "checkout_url", "description": "URL do checkout para finalizar pagamento"}]'::jsonb,
  'Music Lovely',
  'no-reply@musiclovely.com',
  'no-reply@musiclovely.com'
) ON CONFLICT (template_type, language) DO UPDATE SET
  subject = EXCLUDED.subject,
  html_content = EXCLUDED.html_content,
  variables = EXCLUDED.variables,
  updated_at = NOW();

-- Template: follow_up_2 (EN)
INSERT INTO email_templates_i18n (template_type, language, subject, html_content, variables, from_name, from_email, reply_to)
VALUES (
  'follow_up_2',
  'en',
  'Special Gift: 10% OFF on your song! 🎁',
  '<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Special Gift - 10% OFF</title>
  <style>
    body { margin: 0; padding: 0; background: #F6F1EA; color: #2E2B27; font-family: Inter, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
    .wrapper { width: 100%; background: #F6F1EA; padding: 24px 0; }
    .container { width: 100%; max-width: 620px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; box-shadow: 0 2px 14px rgba(0,0,0,0.08); overflow: hidden; }
    .header { padding: 20px; text-align: center; color: #FFFFFF; background: linear-gradient(135deg, #FFF9F5 0%, #C7855E 50%, #B07954 100%); }
    .content { padding: 36px 30px; line-height: 1.6; }
    .content h2 { margin: 0 0 10px; font-size: 26px; color: #2E2B27; }
    .content p { margin: 0 0 18px; font-size: 16px; color: #2E2B27; }
    .discount-box { background: #FFF9F5; border: 2px solid #C7855E; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center; }
    .discount-code { font-size: 24px; font-weight: bold; color: #C7855E; margin: 10px 0; }
    .button { display: inline-block; padding: 14px 32px; background: #C7855E; color: #FFFFFF; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .button:hover { background: #B07954; }
    .footer { text-align: center; font-size: 13px; color: #6B6157; padding: 24px; background: #FFF9F5; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1 style="margin: 0; color: #FFFFFF;">🎵 Music Lovely</h1>
      </div>
      <div class="content">
        <h2>{{first_name}}, imagine the smile on {{destinatario}}''s face... 😍</h2>
        <p>More than <strong>{{total_customers}}</strong> people have already created unforgettable moments with us, and each one was moved by the result.</p>
        <ul style="margin: 20px 0; padding-left: 20px;">
          <li>💕 It''s really something special to see the reaction of those who receive it</li>
          <li>✨ A memory that will last forever</li>
          <li>🎵 A unique way to say "I love you"</li>
        </ul>
        <div class="discount-box">
          <p style="margin: 0 0 10px; font-size: 18px; font-weight: 600;">🎁 Special Gift for You:</p>
          <div class="discount-code">10% OFF with code CANTA10</div>
          <p style="margin: 10px 0 0; font-size: 14px; color: #6B6157;">It''s our way of saying you''re making an amazing choice! 💛</p>
        </div>
        <div style="text-align: center;">
          <a href="{{checkout_url}}" class="button">🚀 Complete Now with Discount</a>
        </div>
        <p style="margin-top: 30px; color: #6B6157; font-size: 14px;">Guarantee this unique moment for <strong>{{destinatario}}</strong>!</p>
      </div>
      <div class="footer">
        <p>© 2025 Music Lovely — <a href="https://musiclovely.com" style="color:#C7855E;">musiclovely.com</a></p>
      </div>
    </div>
  </div>
</body>
</html>',
  '[{"name": "first_name", "description": "Customer first name"}, {"name": "destinatario", "description": "Name of the person the song is for"}, {"name": "total_customers", "description": "Total number of customers (e.g., 1000)"}, {"name": "checkout_url", "description": "Checkout URL to complete payment"}]'::jsonb,
  'Music Lovely',
  'no-reply@musiclovely.com',
  'no-reply@musiclovely.com'
) ON CONFLICT (template_type, language) DO UPDATE SET
  subject = EXCLUDED.subject,
  html_content = EXCLUDED.html_content,
  variables = EXCLUDED.variables,
  updated_at = NOW();

-- Template: follow_up_2 (ES)
INSERT INTO email_templates_i18n (template_type, language, subject, html_content, variables, from_name, from_email, reply_to)
VALUES (
  'follow_up_2',
  'es',
  '¡Regalo Especial: 10% OFF en tu canción! 🎁',
  '<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Regalo Especial - 10% OFF</title>
  <style>
    body { margin: 0; padding: 0; background: #F6F1EA; color: #2E2B27; font-family: Inter, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
    .wrapper { width: 100%; background: #F6F1EA; padding: 24px 0; }
    .container { width: 100%; max-width: 620px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; box-shadow: 0 2px 14px rgba(0,0,0,0.08); overflow: hidden; }
    .header { padding: 20px; text-align: center; color: #FFFFFF; background: linear-gradient(135deg, #FFF9F5 0%, #C7855E 50%, #B07954 100%); }
    .content { padding: 36px 30px; line-height: 1.6; }
    .content h2 { margin: 0 0 10px; font-size: 26px; color: #2E2B27; }
    .content p { margin: 0 0 18px; font-size: 16px; color: #2E2B27; }
    .discount-box { background: #FFF9F5; border: 2px solid #C7855E; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center; }
    .discount-code { font-size: 24px; font-weight: bold; color: #C7855E; margin: 10px 0; }
    .button { display: inline-block; padding: 14px 32px; background: #C7855E; color: #FFFFFF; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .button:hover { background: #B07954; }
    .footer { text-align: center; font-size: 13px; color: #6B6157; padding: 24px; background: #FFF9F5; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1 style="margin: 0; color: #FFFFFF;">🎵 Music Lovely</h1>
      </div>
      <div class="content">
        <h2>{{first_name}}, imagina la sonrisa en el rostro de {{destinatario}}... 😍</h2>
        <p>Más de <strong>{{total_customers}}</strong> personas ya han creado momentos inolvidables con nosotros, y cada una se emocionó con el resultado.</p>
        <ul style="margin: 20px 0; padding-left: 20px;">
          <li>💕 Es realmente algo especial ver la reacción de quien la recibe</li>
          <li>✨ Un recuerdo que durará para siempre</li>
          <li>🎵 Una forma única de decir "te amo"</li>
        </ul>
        <div class="discount-box">
          <p style="margin: 0 0 10px; font-size: 18px; font-weight: 600;">🎁 Regalo Especial para Ti:</p>
          <div class="discount-code">10% OFF con el código CANTA10</div>
          <p style="margin: 10px 0 0; font-size: 14px; color: #6B6157;">¡Es nuestra forma de decir que estás haciendo una elección increíble! 💛</p>
        </div>
        <div style="text-align: center;">
          <a href="{{checkout_url}}" class="button">🚀 Completar Ahora con Descuento</a>
        </div>
        <p style="margin-top: 30px; color: #6B6157; font-size: 14px;">¡Garantiza este momento único para <strong>{{destinatario}}</strong>!</p>
      </div>
      <div class="footer">
        <p>© 2025 Music Lovely — <a href="https://musiclovely.com" style="color:#C7855E;">musiclovely.com</a></p>
      </div>
    </div>
  </div>
</body>
</html>',
  '[{"name": "first_name", "description": "Nombre del cliente"}, {"name": "destinatario", "description": "Nombre de la persona para quien es la canción"}, {"name": "total_customers", "description": "Número total de clientes (ej: 1000)"}, {"name": "checkout_url", "description": "URL del checkout para completar el pago"}]'::jsonb,
  'Music Lovely',
  'no-reply@musiclovely.com',
  'no-reply@musiclovely.com'
) ON CONFLICT (template_type, language) DO UPDATE SET
  subject = EXCLUDED.subject,
  html_content = EXCLUDED.html_content,
  variables = EXCLUDED.variables,
  updated_at = NOW();

-- Template: follow_up_3 (PT) - Quarta mensagem (12 horas) - última chance
INSERT INTO email_templates_i18n (template_type, language, subject, html_content, variables, from_name, from_email, reply_to)
VALUES (
  'follow_up_3',
  'pt',
  'Última mensagem sobre sua música para {{destinatario}}... 💛',
  '<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Última Mensagem</title>
  <style>
    body { margin: 0; padding: 0; background: #F6F1EA; color: #2E2B27; font-family: Inter, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
    .wrapper { width: 100%; background: #F6F1EA; padding: 24px 0; }
    .container { width: 100%; max-width: 620px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; box-shadow: 0 2px 14px rgba(0,0,0,0.08); overflow: hidden; }
    .header { padding: 20px; text-align: center; color: #FFFFFF; background: linear-gradient(135deg, #FFF9F5 0%, #C7855E 50%, #B07954 100%); }
    .content { padding: 36px 30px; line-height: 1.6; }
    .content h2 { margin: 0 0 10px; font-size: 26px; color: #2E2B27; }
    .content p { margin: 0 0 18px; font-size: 16px; color: #2E2B27; }
    .button { display: inline-block; padding: 14px 32px; background: #C7855E; color: #FFFFFF; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .button:hover { background: #B07954; }
    .footer { text-align: center; font-size: 13px; color: #6B6157; padding: 24px; background: #FFF9F5; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1 style="margin: 0; color: #FFFFFF;">🎵 Music Lovely</h1>
      </div>
      <div class="content">
        <h2>{{first_name}}, esta é nossa última mensagem... 💛</h2>
        <p>Esta é nossa última mensagem sobre sua música para <strong>{{destinatario}}</strong>...</p>
        <p>Sabemos que você está pensando bem na decisão, e isso mostra o quanto você se importa. É exatamente por isso que acreditamos que essa música vai ser especial.</p>
        <ul style="margin: 20px 0; padding-left: 20px;">
          <li>✨ <strong>{{destinatario}}</strong> merece um presente único como esse</li>
          <li>💝 Uma forma de mostrar o quanto essa pessoa é importante para você</li>
          <li>🎵 Uma memória que vocês vão guardar para sempre</li>
        </ul>
        <p>Estamos aqui para ajudar você a criar esse momento. Se ainda quiser finalizar, é só clicar no botão abaixo.</p>
        <div style="text-align: center;">
          <a href="{{checkout_url}}" class="button">🚀 Finalizar Agora</a>
        </div>
        <p style="margin-top: 30px; color: #6B6157; font-size: 14px;">💛 Não importa sua decisão, sabemos que você está fazendo o melhor para quem ama.</p>
      </div>
      <div class="footer">
        <p>© 2025 Music Lovely — <a href="https://musiclovely.com" style="color:#C7855E;">musiclovely.com</a></p>
      </div>
    </div>
  </div>
</body>
</html>',
  '[{"name": "first_name", "description": "Primeiro nome do cliente"}, {"name": "destinatario", "description": "Nome da pessoa para quem é a música"}, {"name": "checkout_url", "description": "URL do checkout para finalizar pagamento"}]'::jsonb,
  'Music Lovely',
  'no-reply@musiclovely.com',
  'no-reply@musiclovely.com'
) ON CONFLICT (template_type, language) DO UPDATE SET
  subject = EXCLUDED.subject,
  html_content = EXCLUDED.html_content,
  variables = EXCLUDED.variables,
  updated_at = NOW();

-- Template: follow_up_3 (EN)
INSERT INTO email_templates_i18n (template_type, language, subject, html_content, variables, from_name, from_email, reply_to)
VALUES (
  'follow_up_3',
  'en',
  'Last message about your song for {{destinatario}}... 💛',
  '<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Last Message</title>
  <style>
    body { margin: 0; padding: 0; background: #F6F1EA; color: #2E2B27; font-family: Inter, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
    .wrapper { width: 100%; background: #F6F1EA; padding: 24px 0; }
    .container { width: 100%; max-width: 620px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; box-shadow: 0 2px 14px rgba(0,0,0,0.08); overflow: hidden; }
    .header { padding: 20px; text-align: center; color: #FFFFFF; background: linear-gradient(135deg, #FFF9F5 0%, #C7855E 50%, #B07954 100%); }
    .content { padding: 36px 30px; line-height: 1.6; }
    .content h2 { margin: 0 0 10px; font-size: 26px; color: #2E2B27; }
    .content p { margin: 0 0 18px; font-size: 16px; color: #2E2B27; }
    .button { display: inline-block; padding: 14px 32px; background: #C7855E; color: #FFFFFF; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .button:hover { background: #B07954; }
    .footer { text-align: center; font-size: 13px; color: #6B6157; padding: 24px; background: #FFF9F5; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1 style="margin: 0; color: #FFFFFF;">🎵 Music Lovely</h1>
      </div>
      <div class="content">
        <h2>{{first_name}}, this is our last message... 💛</h2>
        <p>This is our last message about your song for <strong>{{destinatario}}</strong>...</p>
        <p>We know you''re thinking carefully about this decision, and that shows how much you care. That''s exactly why we believe this song will be special.</p>
        <ul style="margin: 20px 0; padding-left: 20px;">
          <li>✨ <strong>{{destinatario}}</strong> deserves a unique gift like this</li>
          <li>💝 A way to show how important this person is to you</li>
          <li>🎵 A memory you''ll both treasure forever</li>
        </ul>
        <p>We''re here to help you create this moment. If you still want to complete your order, just click the button below.</p>
        <div style="text-align: center;">
          <a href="{{checkout_url}}" class="button">🚀 Complete Now</a>
        </div>
        <p style="margin-top: 30px; color: #6B6157; font-size: 14px;">💛 No matter your decision, we know you''re doing your best for someone you love.</p>
      </div>
      <div class="footer">
        <p>© 2025 Music Lovely — <a href="https://musiclovely.com" style="color:#C7855E;">musiclovely.com</a></p>
      </div>
    </div>
  </div>
</body>
</html>',
  '[{"name": "first_name", "description": "Customer first name"}, {"name": "destinatario", "description": "Name of the person the song is for"}, {"name": "checkout_url", "description": "Checkout URL to complete payment"}]'::jsonb,
  'Music Lovely',
  'no-reply@musiclovely.com',
  'no-reply@musiclovely.com'
) ON CONFLICT (template_type, language) DO UPDATE SET
  subject = EXCLUDED.subject,
  html_content = EXCLUDED.html_content,
  variables = EXCLUDED.variables,
  updated_at = NOW();

-- Template: follow_up_3 (ES)
INSERT INTO email_templates_i18n (template_type, language, subject, html_content, variables, from_name, from_email, reply_to)
VALUES (
  'follow_up_3',
  'es',
  'Último mensaje sobre tu canción para {{destinatario}}... 💛',
  '<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Último Mensaje</title>
  <style>
    body { margin: 0; padding: 0; background: #F6F1EA; color: #2E2B27; font-family: Inter, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
    .wrapper { width: 100%; background: #F6F1EA; padding: 24px 0; }
    .container { width: 100%; max-width: 620px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; box-shadow: 0 2px 14px rgba(0,0,0,0.08); overflow: hidden; }
    .header { padding: 20px; text-align: center; color: #FFFFFF; background: linear-gradient(135deg, #FFF9F5 0%, #C7855E 50%, #B07954 100%); }
    .content { padding: 36px 30px; line-height: 1.6; }
    .content h2 { margin: 0 0 10px; font-size: 26px; color: #2E2B27; }
    .content p { margin: 0 0 18px; font-size: 16px; color: #2E2B27; }
    .button { display: inline-block; padding: 14px 32px; background: #C7855E; color: #FFFFFF; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .button:hover { background: #B07954; }
    .footer { text-align: center; font-size: 13px; color: #6B6157; padding: 24px; background: #FFF9F5; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1 style="margin: 0; color: #FFFFFF;">🎵 Music Lovely</h1>
      </div>
      <div class="content">
        <h2>{{first_name}}, este es nuestro último mensaje... 💛</h2>
        <p>Este es nuestro último mensaje sobre tu canción para <strong>{{destinatario}}</strong>...</p>
        <p>Sabemos que estás pensando bien en esta decisión, y eso muestra cuánto te importa. Por eso creemos que esta canción será especial.</p>
        <ul style="margin: 20px 0; padding-left: 20px;">
          <li>✨ <strong>{{destinatario}}</strong> merece un regalo único como este</li>
          <li>💝 Una forma de mostrar lo importante que es esta persona para ti</li>
          <li>🎵 Un recuerdo que ambos guardarán para siempre</li>
        </ul>
        <p>Estamos aquí para ayudarte a crear este momento. Si aún quieres completar tu pedido, solo haz clic en el botón de abajo.</p>
        <div style="text-align: center;">
          <a href="{{checkout_url}}" class="button">🚀 Completar Ahora</a>
        </div>
        <p style="margin-top: 30px; color: #6B6157; font-size: 14px;">💛 No importa tu decisión, sabemos que estás haciendo lo mejor para alguien que amas.</p>
      </div>
      <div class="footer">
        <p>© 2025 Music Lovely — <a href="https://musiclovely.com" style="color:#C7855E;">musiclovely.com</a></p>
      </div>
    </div>
  </div>
</body>
</html>',
  '[{"name": "first_name", "description": "Nombre del cliente"}, {"name": "destinatario", "description": "Nombre de la persona para quien es la canción"}, {"name": "checkout_url", "description": "URL del checkout para completar el pago"}]'::jsonb,
  'Music Lovely',
  'no-reply@musiclovely.com',
  'no-reply@musiclovely.com'
) ON CONFLICT (template_type, language) DO UPDATE SET
  subject = EXCLUDED.subject,
  html_content = EXCLUDED.html_content,
  variables = EXCLUDED.variables,
  updated_at = NOW();

