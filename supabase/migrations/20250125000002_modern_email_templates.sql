-- ==========================================
-- TEMPLATES DE EMAIL MODERNOS E SIMPLES
-- Design limpo com logo do site
-- ==========================================

-- URL da logo (usando URL do próprio site para evitar spam)
-- A logo está em: https://clamorenmusica.com/logo.png
-- Para emails com fundo escuro, usar: https://clamorenmusica.com/logo-white.png
-- IMPORTANTE: Usar PNG em vez de SVG para melhor compatibilidade com clientes de email

-- ==========================================
-- TEMPLATES EM ESPANHOL (ES) - Idioma principal
-- ==========================================

-- Template: order_paid (Pedido Pago)
INSERT INTO email_templates_es (template_type, subject, html_content, variables, from_name, from_email, reply_to)
VALUES (
  'order_paid',
  'Pedido Confirmado - Tu Música Está Siendo Creada',
  '<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pedido Confirmado</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; background-color: #FDF6ED; line-height: 1.6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #FDF6ED; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 600px;">
          <!-- Logo Header -->
          <tr>
            <td align="center" style="padding: 40px 30px 30px;">
              <img src="https://clamorenmusica.com/logo.png" alt="Clamor en Música" width="120" height="65" style="display: block; max-width: 120px; height: auto; margin: 0 auto;">
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 0 30px 30px;">
              <h1 style="margin: 0 0 20px; font-size: 24px; font-weight: 600; color: #2C1810; text-align: center;">¡Pedido Confirmado!</h1>
              <p style="margin: 0 0 16px; font-size: 16px; color: #4A4A4A;">Hola {{customer_name}},</p>
              <p style="margin: 0 0 24px; font-size: 16px; color: #4A4A4A;">Tu pedido ha sido confirmado y estamos creando tu música personalizada. Te notificaremos cuando esté lista.</p>
              
              <!-- Resumen del Pedido -->
              <div style="background-color: #F5F5F5; border-radius: 8px; padding: 24px; margin: 24px 0;">
                <h2 style="margin: 0 0 20px; font-size: 18px; font-weight: 600; color: #2C1810;">Resumen del Pedido</h2>
                
                <div style="margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #E0E0E0;">
                  <p style="margin: 0 0 4px; font-size: 14px; color: #666; font-weight: 500;">ID del Pedido:</p>
                  <p style="margin: 0; font-size: 16px; color: #2C1810; font-weight: 600;">{{order_id}}</p>
                </div>
                
                <div style="margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #E0E0E0;">
                  <p style="margin: 0 0 4px; font-size: 14px; color: #666; font-weight: 500;">Pagado por:</p>
                  <p style="margin: 0; font-size: 16px; color: #2C1810; font-weight: 600;">{{customer_name}}</p>
                </div>
                
                <div style="margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #E0E0E0;">
                  <p style="margin: 0 0 4px; font-size: 14px; color: #666; font-weight: 500;">Música para:</p>
                  <p style="margin: 0; font-size: 16px; color: #2C1810; font-weight: 600;">{{about_who}}</p>
                </div>
                
                <div style="margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #E0E0E0;">
                  <p style="margin: 0 0 4px; font-size: 14px; color: #666; font-weight: 500;">Estilo Musical:</p>
                  <p style="margin: 0; font-size: 16px; color: #2C1810;">{{style}}</p>
                </div>
                
                <div style="margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #E0E0E0;">
                  <p style="margin: 0 0 4px; font-size: 14px; color: #666; font-weight: 500;">Plan:</p>
                  <p style="margin: 0; font-size: 16px; color: #2C1810;">{{plan}}</p>
                </div>
                
                <div>
                  <p style="margin: 0 0 4px; font-size: 14px; color: #666; font-weight: 500;">Tiempo de Entrega:</p>
                  <p style="margin: 0; font-size: 16px; color: #2C1810;">{{delivery_time}}</p>
                </div>
              </div>
              
              <p style="margin: 24px 0 0; font-size: 14px; color: #666; text-align: center;">Gracias por confiar en Clamor en Música</p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 30px; background-color: #F9F9F9; border-radius: 0 0 12px 12px; text-align: center;">
              <p style="margin: 0 0 8px; font-size: 12px; color: #999;">© 2025 Clamor en Música. Todos los derechos reservados.</p>
              <p style="margin: 0; font-size: 12px; color: #999;">Si tienes preguntas, responde a este email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>',
  '["customer_name", "order_id", "about_who", "recipient_name", "style", "music_style", "plan", "delivery_time", "release_date"]'::jsonb,
  'Clamor en Música',
  'hello@clamorenmusica.com',
  'support@clamorenmusica.com'
)
ON CONFLICT (template_type) DO UPDATE SET
  subject = EXCLUDED.subject,
  html_content = EXCLUDED.html_content,
  variables = EXCLUDED.variables,
  from_name = EXCLUDED.from_name,
  from_email = EXCLUDED.from_email,
  reply_to = EXCLUDED.reply_to,
  updated_at = NOW();

-- Template: music_released (Música Liberada)
INSERT INTO email_templates_es (template_type, subject, html_content, variables, from_name, from_email, reply_to)
VALUES (
  'music_released',
  '¡Tu Música Está Lista! - Clamor en Música',
  '<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tu Música Está Lista</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; background-color: #FDF6ED; line-height: 1.6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #FDF6ED; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 600px;">
          <!-- Logo Header -->
          <tr>
            <td align="center" style="padding: 40px 30px 30px;">
              <img src="https://clamorenmusica.com/logo.png" alt="Clamor en Música" width="120" height="65" style="display: block; max-width: 120px; height: auto; margin: 0 auto;">
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 0 30px 30px;">
              <h1 style="margin: 0 0 20px; font-size: 24px; font-weight: 600; color: #2C1810; text-align: center;">¡Tu Música Está Lista!</h1>
              <p style="margin: 0 0 16px; font-size: 16px; color: #4A4A4A;">Hola {{customer_name}},</p>
              <p style="margin: 0 0 24px; font-size: 16px; color: #4A4A4A;">¡Excelentes noticias! Tu música personalizada "{{song_title}}" está lista para ser descargada.</p>
              <div style="text-align: center; margin: 32px 0;">
                <a href="{{download_url}}" style="display: inline-block; background-color: #C7855E; color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">Descargar Música</a>
              </div>
              <p style="margin: 24px 0 0; font-size: 14px; color: #666; text-align: center;">Gracias por confiar en Clamor en Música</p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 30px; background-color: #F9F9F9; border-radius: 0 0 12px 12px; text-align: center;">
              <p style="margin: 0 0 8px; font-size: 12px; color: #999;">© 2025 Clamor en Música. Todos los derechos reservados.</p>
              <p style="margin: 0; font-size: 12px; color: #999;">Si tienes preguntas, responde a este email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>',
  '["customer_name", "song_title", "download_url"]'::jsonb,
  'Clamor en Música',
  'hello@clamorenmusica.com',
  'support@clamorenmusica.com'
)
ON CONFLICT (template_type) DO UPDATE SET
  subject = EXCLUDED.subject,
  html_content = EXCLUDED.html_content,
  variables = EXCLUDED.variables,
  from_name = EXCLUDED.from_name,
  from_email = EXCLUDED.from_email,
  reply_to = EXCLUDED.reply_to,
  updated_at = NOW();

-- Template: music_ready (Música Pronta)
INSERT INTO email_templates_es (template_type, subject, html_content, variables, from_name, from_email, reply_to)
VALUES (
  'music_ready',
  'Tu Música Personalizada Está Lista - Clamor en Música',
  '<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Música Lista</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; background-color: #FDF6ED; line-height: 1.6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #FDF6ED; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 600px;">
          <!-- Logo Header -->
          <tr>
            <td align="center" style="padding: 40px 30px 30px;">
              <img src="https://clamorenmusica.com/logo.png" alt="Clamor en Música" width="120" height="65" style="display: block; max-width: 120px; height: auto; margin: 0 auto;">
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 0 30px 30px;">
              <h1 style="margin: 0 0 20px; font-size: 24px; font-weight: 600; color: #2C1810; text-align: center;">¡Tu Música Está Lista!</h1>
              <p style="margin: 0 0 16px; font-size: 16px; color: #4A4A4A;">Hola {{customer_name}},</p>
              <p style="margin: 0 0 24px; font-size: 16px; color: #4A4A4A;">Tu música personalizada "{{song_title}}" está lista. Haz clic en el botón para escucharla y descargarla.</p>
              <div style="text-align: center; margin: 32px 0;">
                <a href="{{song_url}}" style="display: inline-block; background-color: #C7855E; color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">Escuchar Música</a>
              </div>
              <p style="margin: 24px 0 0; font-size: 14px; color: #666; text-align: center;">Gracias por confiar en Clamor en Música</p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 30px; background-color: #F9F9F9; border-radius: 0 0 12px 12px; text-align: center;">
              <p style="margin: 0 0 8px; font-size: 12px; color: #999;">© 2025 Clamor en Música. Todos los derechos reservados.</p>
              <p style="margin: 0; font-size: 12px; color: #999;">Si tienes preguntas, responde a este email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>',
  '["customer_name", "song_title", "song_url"]'::jsonb,
  'Clamor en Música',
  'hello@clamorenmusica.com',
  'support@clamorenmusica.com'
)
ON CONFLICT (template_type) DO UPDATE SET
  subject = EXCLUDED.subject,
  html_content = EXCLUDED.html_content,
  variables = EXCLUDED.variables,
  from_name = EXCLUDED.from_name,
  from_email = EXCLUDED.from_email,
  reply_to = EXCLUDED.reply_to,
  updated_at = NOW();

-- Template: lyrics_approval (Aprovação de Letras)
INSERT INTO email_templates_es (template_type, subject, html_content, variables, from_name, from_email, reply_to)
VALUES (
  'lyrics_approval',
  'Aproba Tu Letra - Clamor en Música',
  '<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Aprobar Letra</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; background-color: #FDF6ED; line-height: 1.6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #FDF6ED; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 600px;">
          <!-- Logo Header -->
          <tr>
            <td align="center" style="padding: 40px 30px 30px;">
              <img src="https://clamorenmusica.com/logo.png" alt="Clamor en Música" width="120" height="65" style="display: block; max-width: 120px; height: auto; margin: 0 auto;">
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 0 30px 30px;">
              <h1 style="margin: 0 0 20px; font-size: 24px; font-weight: 600; color: #2C1810; text-align: center;">Tu Letra Está Lista</h1>
              <p style="margin: 0 0 16px; font-size: 16px; color: #4A4A4A;">Hola {{customer_name}},</p>
              <p style="margin: 0 0 24px; font-size: 16px; color: #4A4A4A;">Hemos creado la letra de tu música personalizada. Por favor, revísala y aprueba para continuar con la producción.</p>
              <div style="background-color: #F5F5F5; border-radius: 8px; padding: 20px; margin: 24px 0;">
                <p style="margin: 0 0 12px; font-size: 14px; color: #666; font-weight: 500;">Título:</p>
                <p style="margin: 0 0 16px; font-size: 18px; color: #2C1810; font-weight: 600;">{{song_title}}</p>
                <p style="margin: 0 0 12px; font-size: 14px; color: #666; font-weight: 500;">Letra:</p>
                <div style="background-color: #FFFFFF; border: 1px solid #E0E0E0; border-radius: 6px; padding: 16px; white-space: pre-wrap; font-size: 14px; color: #4A4A4A; line-height: 1.8;">{{lyrics_preview}}</div>
              </div>
              <div style="text-align: center; margin: 32px 0;">
                <a href="{{approval_url}}" style="display: inline-block; background-color: #C7855E; color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">Aprobar Letra</a>
              </div>
              <p style="margin: 24px 0 0; font-size: 14px; color: #666; text-align: center;">Gracias por confiar en Clamor en Música</p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 30px; background-color: #F9F9F9; border-radius: 0 0 12px 12px; text-align: center;">
              <p style="margin: 0 0 8px; font-size: 12px; color: #999;">© 2025 Clamor en Música. Todos los derechos reservados.</p>
              <p style="margin: 0; font-size: 12px; color: #999;">Si tienes preguntas, responde a este email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>',
  '["customer_name", "song_title", "lyrics_preview", "approval_url"]'::jsonb,
  'Clamor en Música',
  'hello@clamorenmusica.com',
  'support@clamorenmusica.com'
)
ON CONFLICT (template_type) DO UPDATE SET
  subject = EXCLUDED.subject,
  html_content = EXCLUDED.html_content,
  variables = EXCLUDED.variables,
  from_name = EXCLUDED.from_name,
  from_email = EXCLUDED.from_email,
  reply_to = EXCLUDED.reply_to,
  updated_at = NOW();

-- Template: payment_confirmed (Pagamento Confirmado)
INSERT INTO email_templates_es (template_type, subject, html_content, variables, from_name, from_email, reply_to)
VALUES (
  'payment_confirmed',
  'Pago Confirmado - Clamor en Música',
  '<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pago Confirmado</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; background-color: #FDF6ED; line-height: 1.6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #FDF6ED; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 600px;">
          <!-- Logo Header -->
          <tr>
            <td align="center" style="padding: 40px 30px 30px;">
              <img src="https://clamorenmusica.com/logo.png" alt="Clamor en Música" width="120" height="65" style="display: block; max-width: 120px; height: auto; margin: 0 auto;">
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 0 30px 30px;">
              <h1 style="margin: 0 0 20px; font-size: 24px; font-weight: 600; color: #2C1810; text-align: center;">¡Pago Confirmado!</h1>
              <p style="margin: 0 0 16px; font-size: 16px; color: #4A4A4A;">Hola {{customer_name}},</p>
              <p style="margin: 0 0 24px; font-size: 16px; color: #4A4A4A;">Tu pago ha sido confirmado exitosamente. Ya estamos trabajando en tu música personalizada.</p>
              <div style="background-color: #F5F5F5; border-radius: 8px; padding: 20px; margin: 24px 0;">
                <p style="margin: 0 0 8px; font-size: 14px; color: #666; font-weight: 500;">Monto:</p>
                <p style="margin: 0; font-size: 20px; color: #2C1810; font-weight: 600;">{{amount}}</p>
              </div>
              <p style="margin: 24px 0 0; font-size: 14px; color: #666; text-align: center;">Gracias por confiar en Clamor en Música</p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 30px; background-color: #F9F9F9; border-radius: 0 0 12px 12px; text-align: center;">
              <p style="margin: 0 0 8px; font-size: 12px; color: #999;">© 2025 Clamor en Música. Todos los derechos reservados.</p>
              <p style="margin: 0; font-size: 12px; color: #999;">Si tienes preguntas, responde a este email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>',
  '["customer_name", "amount"]'::jsonb,
  'Clamor en Música',
  'hello@clamorenmusica.com',
  'support@clamorenmusica.com'
)
ON CONFLICT (template_type) DO UPDATE SET
  subject = EXCLUDED.subject,
  html_content = EXCLUDED.html_content,
  variables = EXCLUDED.variables,
  from_name = EXCLUDED.from_name,
  from_email = EXCLUDED.from_email,
  reply_to = EXCLUDED.reply_to,
  updated_at = NOW();
