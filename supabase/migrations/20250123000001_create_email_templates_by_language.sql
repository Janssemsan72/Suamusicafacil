-- ==========================================
-- CRIAR TABELAS DE EMAIL POR IDIOMA
-- Sistema simplificado com 3 tabelas separadas
-- ==========================================

-- 1. CRIAR TABELA PORTUGUÊS
CREATE TABLE email_templates_pt (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_type TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  from_name TEXT DEFAULT 'Music Lovely',
  from_email TEXT DEFAULT 'no-reply@musiclovely.com',
  reply_to TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CRIAR TABELA INGLÊS
CREATE TABLE email_templates_en (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_type TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  from_name TEXT DEFAULT 'Music Lovely',
  from_email TEXT DEFAULT 'no-reply@musiclovely.com',
  reply_to TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CRIAR TABELA ESPANHOL
CREATE TABLE email_templates_es (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_type TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  from_name TEXT DEFAULT 'Music Lovely',
  from_email TEXT DEFAULT 'no-reply@musiclovely.com',
  reply_to TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CONFIGURAR RLS PARA TODAS AS TABELAS
ALTER TABLE email_templates_pt ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates_en ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates_es ENABLE ROW LEVEL SECURITY;

-- Políticas para email_templates_pt
CREATE POLICY "Allow service role full access pt" ON email_templates_pt
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow public read access pt" ON email_templates_pt
  FOR SELECT USING (true);

-- Políticas para email_templates_en
CREATE POLICY "Allow service role full access en" ON email_templates_en
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow public read access en" ON email_templates_en
  FOR SELECT USING (true);

-- Políticas para email_templates_es
CREATE POLICY "Allow service role full access es" ON email_templates_es
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow public read access es" ON email_templates_es
  FOR SELECT USING (true);

-- 5. INSERIR TEMPLATES PORTUGUESES (BASE)
-- Template: order_paid (Português)
INSERT INTO email_templates_pt (
  template_type,
  subject,
  html_content,
  variables,
  from_name,
  from_email
) VALUES (
  'order_paid',
  '🎉 Pagamento Confirmado - Sua Música Está Sendo Criada!',
  '<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Pagamento Confirmado 🎉 | Music Lovely</title>
    <style>
      body {
        margin: 0; padding: 0;
        background: #F6F1EA;
        color: #2E2B27;
        font-family: Inter, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      }
      a { color: #C7855E; text-decoration: none; }
      img { border: 0; line-height: 100%; outline: none; text-decoration: none; }

      .wrapper {
        width: 100%;
        background: #F6F1EA;
        padding: 24px 0;
      }
      .container {
        width: 100%;
        max-width: 620px;
        margin: 0 auto;
        background: #FFFFFF;
        border-radius: 16px;
        box-shadow: 0 2px 14px rgba(0,0,0,0.08);
        overflow: hidden;
      }

      .header {
        padding: 32px 20px;
        text-align: center;
        color: #FFFFFF;
        background: linear-gradient(135deg, #FFF9F5 0%, #C7855E 50%, #B07954 100%);
      }
      .header img { width: 140px; height: auto; margin-bottom: 12px; }
      .header h1 {
        margin: 0; font-size: 28px; letter-spacing: 0.3px; color: #FFFFFF;
      }

      .content { padding: 36px 30px; line-height: 1.6; }
      .content h2 { margin: 0 0 10px; font-size: 26px; color: #2E2B27; letter-spacing: -0.02em; }
      .content p { margin: 0 0 18px; font-size: 16px; color: #2E2B27; }

      .info-box {
        background: #FFF9F5;
        border: 1px solid #E5DDD4;
        border-left: 4px solid #C7855E;
        border-radius: 12px;
        padding: 20px;
        margin: 20px 0;
      }
      .info-box p { margin: 8px 0; font-size: 15px; }
      .info-box strong { color: #C7855E; }

      .footer {
        text-align: center; font-size: 13px; color: #6B6157;
        padding: 24px;
        background: #FFF9F5;
      }
      .footer p { margin: 6px 0; }
    </style>
  </head>
  <body style="background:#F6F1EA; margin:0; padding:0;">
    <div class="wrapper" style="background:#F6F1EA;">
      <div class="container" style="background:#FFFFFF;">
        <div class="header">
          <img src="https://zagkvtxarndluusiluhb.supabase.co/storage/v1/object/public/home-media/logo-white.png" alt="Music Lovely"/>
        </div>

        <div class="content">
          <h2>Pagamento Confirmado!</h2>
          <p>Olá <strong>{{customer_name}}</strong>,</p>
          <p>
            Recebemos seu pagamento e já começamos a criar uma música personalizada incrível para <strong>{{recipient_name}}</strong>! 🎵
          </p>

          <div class="info-box">
            <p><strong>📋 Número do Pedido:</strong> {{order_id}}</p>
            <p><strong>🎸 Estilo Musical:</strong> {{music_style}}</p>
            <p><strong>⏰ Previsão de Entrega:</strong> {{delivery_time}}</p>
          </div>

          <p>
            Nossa IA está trabalhando para compor uma música única baseada nas informações que você forneceu. 
            Você receberá um novo email assim que sua música estiver pronta para download.
          </p>

          <p style="color:#6B6157; font-size:14px; margin-top:24px;">
            Obrigado por escolher o <strong>Music Lovely</strong> para criar momentos especiais! ❤️
          </p>
        </div>

        <div class="footer">
          <p>© 2025 Music Lovely — <a href="https://musiclovely.com" style="color:#C7855E;">musiclovely.com</a></p>
          <p>Este é um email automático. Em caso de dúvidas, entre em contato conosco.</p>
        </div>
      </div>
    </div>
  </body>
</html>',
  '["customer_name", "recipient_name", "order_id", "music_style", "delivery_time"]'::jsonb,
  'Music Lovely',
  'no-reply@musiclovely.com'
);

-- Template: music_released (Português)
INSERT INTO email_templates_pt (
  template_type,
  subject,
  html_content,
  variables,
  from_name,
  from_email
) VALUES (
  'music_released',
  '🎵 Sua Música Está Pronta para Download!',
  '<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Sua Música Está Pronta | Music Lovely</title>
    <style>
      body {
        margin: 0; padding: 0;
        background: #F5F0EB;
        color: #362E26;
        -webkit-text-size-adjust: 100%;
        -ms-text-size-adjust: 100%;
        font-family: Inter, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      }
      a { color: #C18B67; text-decoration: none; }
      img { border: 0; line-height: 100%; outline: none; text-decoration: none; max-width: 100%; height: auto; }

      .wrapper {
        width: 100%;
        background: #F5F0EB;
        padding: 24px 0;
      }
      .container {
        width: 100%;
        max-width: 620px;
        margin: 0 auto;
        background: #FFFFFF;
        border-radius: 16px;
        box-shadow: 0 2px 14px rgba(0,0,0,0.08);
        overflow: hidden;
      }

      .header {
        padding: 32px 20px;
        text-align: center;
        color: #FFFFFF;
        background: linear-gradient(135deg, #E7CC9D 0%, #C18B67 50%, #B07954 100%);
      }
      .header img {
        max-width: 200px;
        height: auto;
        display: inline-block;
      }

      .content { padding: 30px; line-height: 1.6; }
      .content h2 { margin: 0 0 10px; font-size: 22px; color: #362E26; }
      .content p { margin: 0 0 18px; font-size: 16px; color: #362E26; }

      .song-preview {
        background: #FBF8F4;
        border: 1px solid #E6DED6;
        border-left: 4px solid #C18B67;
        border-radius: 10px;
        padding: 18px;
        margin: 18px 0;
      }
      .song-preview p { margin: 6px 0; }
      .song-preview strong { color: #C18B67; }

      .cover-img {
        text-align: center;
        margin: 30px 0;
      }
      .cover-img img {
        max-width: 100%;
        height: auto;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      }

      .cta-wrapper { text-align: center; margin: 22px 0 6px; }
      .button {
        display: inline-block; 
        padding: 14px 28px;
        background: #C18B67; 
        color: #FFFFFF !important;
        border-radius: 10px; 
        font-weight: 600;
        margin: 10px 5px;
      }
      .button:hover { filter: brightness(0.95); }

      .tip-box {
        background: #FFF9F0;
        border: 1px solid #F4E4C1;
        border-left: 4px solid #E7CC9D;
        border-radius: 10px;
        padding: 16px;
        margin: 24px 0;
        text-align: center;
      }

      .footer {
        text-align: center; 
        font-size: 13px; 
        color: #6B6157;
        padding: 22px 24px;
      }

      @media (prefers-color-scheme: dark) {
        body, .wrapper { background: #362E26 !important; color: #F5F0EB !important; }
        .container { background: #413830 !important; }
        .content h2, .content p { color: #F5F0EB !important; }
        .song-preview { background: #494036 !important; border-color: #584C41 !important; }
        .tip-box { background: #494036 !important; border-color: #584C41 !important; }
        .footer { color: #AD9985 !important; }
      }
    </style>
  </head>
  <body style="background:#F5F0EB; margin:0; padding:0;">
    <div class="wrapper" style="background:#F5F0EB;">
      <div class="container" style="background:#FFFFFF;">
        <div class="header">
          <img src="https://zagkvtxarndluusiluhb.supabase.co/storage/v1/object/public/home-media/logo-white.png" alt="Music Lovely - Crie sua música personalizada" width="120" style="display: block; margin: 0 auto; max-width: 120px; height: auto; border: 0; outline: none;" loading="eager">
        </div>

        <div class="content">
          <h2>🎉 Sua música está pronta!</h2>
          <p>Olá <strong>{{customer_name}}</strong>,</p>
          <p>Sua música personalizada para <strong>{{recipient_name}}</strong> foi criada com muito carinho e já está disponível para download!</p>

          <div class="cover-img">
            <img src="{{cover_url}}" alt="Capa da música" />
          </div>

          <div class="song-preview">
            <p><strong>Estilo:</strong> {{music_style}}</p>
            <p><strong>Duração:</strong> {{duration}}</p>
            <p><strong>Liberado em:</strong> {{release_date}}</p>
          </div>

          <div class="cta-wrapper">
            <p style="margin-bottom: 20px; font-weight: 600;">Escolha sua versão preferida:</p>
            <a href="{{download_url_1}}" class="button">🎵 Baixar Versão 1</a>
            <a href="{{download_url_2}}" class="button">🎵 Baixar Versão 2</a>
          </div>

          <div class="tip-box">
            <p style="margin: 0; font-size: 15px; color: #C18B67; font-weight: 600;">
              ✨ Dica: Esta música foi criada especialmente para você. Compartilhe esse momento único com quem você ama!
            </p>
          </div>

          <p style="color: #6B6157; font-size: 14px; margin-top: 30px;">
            Esperamos que você aproveite sua música personalizada! Se tiver qualquer dúvida, estamos à disposição.
          </p>
        </div>

        <div class="footer">
          <p>© 2025 Music Lovely — <a href="https://musiclovely.com" style="color:#C18B67;">musiclovely.com</a></p>
          <p>Este é um email automático. Para suporte, responda este email.</p>
        </div>
      </div>
    </div>
  </body>
</html>',
  '["customer_name", "recipient_name", "music_style", "duration", "release_date", "cover_url", "download_url_1", "download_url_2"]'::jsonb,
  'Music Lovely',
  'no-reply@musiclovely.com'
);

-- 6. INSERIR TEMPLATES INGLESES
-- Template: order_paid (Inglês)
INSERT INTO email_templates_en (
  template_type,
  subject,
  html_content,
  variables,
  from_name,
  from_email
) VALUES (
  'order_paid',
  '🎉 Payment Confirmed - Your Music Is Being Created!',
  '<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Payment Confirmed 🎉 | Music Lovely</title>
    <style>
      body {
        margin: 0; padding: 0;
        background: #F6F1EA;
        color: #2E2B27;
        font-family: Inter, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      }
      a { color: #C7855E; text-decoration: none; }
      img { border: 0; line-height: 100%; outline: none; text-decoration: none; }

      .wrapper {
        width: 100%;
        background: #F6F1EA;
        padding: 24px 0;
      }
      .container {
        width: 100%;
        max-width: 620px;
        margin: 0 auto;
        background: #FFFFFF;
        border-radius: 16px;
        box-shadow: 0 2px 14px rgba(0,0,0,0.08);
        overflow: hidden;
      }

      .header {
        padding: 32px 20px;
        text-align: center;
        color: #FFFFFF;
        background: linear-gradient(135deg, #FFF9F5 0%, #C7855E 50%, #B07954 100%);
      }
      .header img { width: 140px; height: auto; margin-bottom: 12px; }
      .header h1 {
        margin: 0; font-size: 28px; letter-spacing: 0.3px; color: #FFFFFF;
      }

      .content { padding: 36px 30px; line-height: 1.6; }
      .content h2 { margin: 0 0 10px; font-size: 26px; color: #2E2B27; letter-spacing: -0.02em; }
      .content p { margin: 0 0 18px; font-size: 16px; color: #2E2B27; }

      .info-box {
        background: #FFF9F5;
        border: 1px solid #E5DDD4;
        border-left: 4px solid #C7855E;
        border-radius: 12px;
        padding: 20px;
        margin: 20px 0;
      }
      .info-box p { margin: 8px 0; font-size: 15px; }
      .info-box strong { color: #C7855E; }

      .footer {
        text-align: center; font-size: 13px; color: #6B6157;
        padding: 24px;
        background: #FFF9F5;
      }
      .footer p { margin: 6px 0; }
    </style>
  </head>
  <body style="background:#F6F1EA; margin:0; padding:0;">
    <div class="wrapper" style="background:#F6F1EA;">
      <div class="container" style="background:#FFFFFF;">
        <div class="header">
          <img src="https://zagkvtxarndluusiluhb.supabase.co/storage/v1/object/public/home-media/logo-white.png" alt="Music Lovely"/>
        </div>

        <div class="content">
          <h2>Payment Confirmed!</h2>
          <p>Hello <strong>{{customer_name}}</strong>,</p>
          <p>
            We''ve received your payment and started creating an amazing personalized song for <strong>{{recipient_name}}</strong>! 🎵
          </p>

          <div class="info-box">
            <p><strong>📋 Order Number:</strong> {{order_id}}</p>
            <p><strong>🎸 Music Style:</strong> {{music_style}}</p>
            <p><strong>⏰ Estimated Delivery:</strong> {{delivery_time}}</p>
          </div>

          <p>
            Our AI is working to compose a unique song based on the information you provided. 
            You''ll receive a new email as soon as your music is ready for download.
          </p>

          <p style="color:#6B6157; font-size:14px; margin-top:24px;">
            Thank you for choosing <strong>Music Lovely</strong> to create special moments! ❤️
          </p>
        </div>

        <div class="footer">
          <p>© 2025 Music Lovely — <a href="https://musiclovely.com" style="color:#C7855E;">musiclovely.com</a></p>
          <p>This is an automated email. If you have any questions, please contact us.</p>
        </div>
      </div>
    </div>
  </body>
</html>',
  '["customer_name", "recipient_name", "order_id", "music_style", "delivery_time"]'::jsonb,
  'Music Lovely',
  'no-reply@musiclovely.com'
);

-- Template: music_released (Inglês)
INSERT INTO email_templates_en (
  template_type,
  subject,
  html_content,
  variables,
  from_name,
  from_email
) VALUES (
  'music_released',
  '🎵 Your Music Is Ready for Download!',
  '<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Your Music Is Ready | Music Lovely</title>
    <style>
      body {
        margin: 0; padding: 0;
        background: #F5F0EB;
        color: #362E26;
        -webkit-text-size-adjust: 100%;
        -ms-text-size-adjust: 100%;
        font-family: Inter, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      }
      a { color: #C18B67; text-decoration: none; }
      img { border: 0; line-height: 100%; outline: none; text-decoration: none; max-width: 100%; height: auto; }

      .wrapper {
        width: 100%;
        background: #F5F0EB;
        padding: 24px 0;
      }
      .container {
        width: 100%;
        max-width: 620px;
        margin: 0 auto;
        background: #FFFFFF;
        border-radius: 16px;
        box-shadow: 0 2px 14px rgba(0,0,0,0.08);
        overflow: hidden;
      }

      .header {
        padding: 32px 20px;
        text-align: center;
        color: #FFFFFF;
        background: linear-gradient(135deg, #E7CC9D 0%, #C18B67 50%, #B07954 100%);
      }
      .header img {
        max-width: 200px;
        height: auto;
        display: inline-block;
      }

      .content { padding: 30px; line-height: 1.6; }
      .content h2 { margin: 0 0 10px; font-size: 22px; color: #362E26; }
      .content p { margin: 0 0 18px; font-size: 16px; color: #362E26; }

      .song-preview {
        background: #FBF8F4;
        border: 1px solid #E6DED6;
        border-left: 4px solid #C18B67;
        border-radius: 10px;
        padding: 18px;
        margin: 18px 0;
      }
      .song-preview p { margin: 6px 0; }
      .song-preview strong { color: #C18B67; }

      .cover-img {
        text-align: center;
        margin: 30px 0;
      }
      .cover-img img {
        max-width: 100%;
        height: auto;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      }

      .cta-wrapper { text-align: center; margin: 22px 0 6px; }
      .button {
        display: inline-block; 
        padding: 14px 28px;
        background: #C18B67; 
        color: #FFFFFF !important;
        border-radius: 10px; 
        font-weight: 600;
        margin: 10px 5px;
      }
      .button:hover { filter: brightness(0.95); }

      .tip-box {
        background: #FFF9F0;
        border: 1px solid #F4E4C1;
        border-left: 4px solid #E7CC9D;
        border-radius: 10px;
        padding: 16px;
        margin: 24px 0;
        text-align: center;
      }

      .footer {
        text-align: center; 
        font-size: 13px; 
        color: #6B6157;
        padding: 22px 24px;
      }

      @media (prefers-color-scheme: dark) {
        body, .wrapper { background: #362E26 !important; color: #F5F0EB !important; }
        .container { background: #413830 !important; }
        .content h2, .content p { color: #F5F0EB !important; }
        .song-preview { background: #494036 !important; border-color: #584C41 !important; }
        .tip-box { background: #494036 !important; border-color: #584C41 !important; }
        .footer { color: #AD9985 !important; }
      }
    </style>
  </head>
  <body style="background:#F5F0EB; margin:0; padding:0;">
    <div class="wrapper" style="background:#F5F0EB;">
      <div class="container" style="background:#FFFFFF;">
        <div class="header">
          <img src="https://zagkvtxarndluusiluhb.supabase.co/storage/v1/object/public/home-media/logo-white.png" alt="Music Lovely - Create your personalized music" width="120" style="display: block; margin: 0 auto; max-width: 120px; height: auto; border: 0; outline: none;" loading="eager">
        </div>

        <div class="content">
          <h2>🎉 Your music is ready!</h2>
          <p>Hello <strong>{{customer_name}}</strong>,</p>
          <p>Your personalized song for <strong>{{recipient_name}}</strong> has been created with love and is now available for download!</p>

          <div class="cover-img">
            <img src="{{cover_url}}" alt="Music cover" />
          </div>

          <div class="song-preview">
            <p><strong>Style:</strong> {{music_style}}</p>
            <p><strong>Duration:</strong> {{duration}}</p>
            <p><strong>Released on:</strong> {{release_date}}</p>
          </div>

          <div class="cta-wrapper">
            <p style="margin-bottom: 20px; font-weight: 600;">Choose your preferred version:</p>
            <a href="{{download_url_1}}" class="button">🎵 Download Version 1</a>
            <a href="{{download_url_2}}" class="button">🎵 Download Version 2</a>
          </div>

          <div class="tip-box">
            <p style="margin: 0; font-size: 15px; color: #C18B67; font-weight: 600;">
              ✨ Tip: This song was created especially for you. Share this unique moment with those you love!
            </p>
          </div>

          <p style="color: #6B6157; font-size: 14px; margin-top: 30px;">
            We hope you enjoy your personalized music! If you have any questions, we''re here to help.
          </p>
        </div>

        <div class="footer">
          <p>© 2025 Music Lovely — <a href="https://musiclovely.com" style="color:#C18B67;">musiclovely.com</a></p>
          <p>This is an automated email. For support, reply to this email.</p>
        </div>
      </div>
    </div>
  </body>
</html>',
  '["customer_name", "recipient_name", "music_style", "duration", "release_date", "cover_url", "download_url_1", "download_url_2"]'::jsonb,
  'Music Lovely',
  'no-reply@musiclovely.com'
);

-- 7. INSERIR TEMPLATES ESPANHÓIS
-- Template: order_paid (Espanhol)
INSERT INTO email_templates_es (
  template_type,
  subject,
  html_content,
  variables,
  from_name,
  from_email
) VALUES (
  'order_paid',
  '🎉 Pago Confirmado - ¡Tu Música Está Siendo Creada!',
  '<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Pago Confirmado 🎉 | Music Lovely</title>
    <style>
      body {
        margin: 0; padding: 0;
        background: #F6F1EA;
        color: #2E2B27;
        font-family: Inter, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      }
      a { color: #C7855E; text-decoration: none; }
      img { border: 0; line-height: 100%; outline: none; text-decoration: none; }

      .wrapper {
        width: 100%;
        background: #F6F1EA;
        padding: 24px 0;
      }
      .container {
        width: 100%;
        max-width: 620px;
        margin: 0 auto;
        background: #FFFFFF;
        border-radius: 16px;
        box-shadow: 0 2px 14px rgba(0,0,0,0.08);
        overflow: hidden;
      }

      .header {
        padding: 32px 20px;
        text-align: center;
        color: #FFFFFF;
        background: linear-gradient(135deg, #FFF9F5 0%, #C7855E 50%, #B07954 100%);
      }
      .header img { width: 140px; height: auto; margin-bottom: 12px; }
      .header h1 {
        margin: 0; font-size: 28px; letter-spacing: 0.3px; color: #FFFFFF;
      }

      .content { padding: 36px 30px; line-height: 1.6; }
      .content h2 { margin: 0 0 10px; font-size: 26px; color: #2E2B27; letter-spacing: -0.02em; }
      .content p { margin: 0 0 18px; font-size: 16px; color: #2E2B27; }

      .info-box {
        background: #FFF9F5;
        border: 1px solid #E5DDD4;
        border-left: 4px solid #C7855E;
        border-radius: 12px;
        padding: 20px;
        margin: 20px 0;
      }
      .info-box p { margin: 8px 0; font-size: 15px; }
      .info-box strong { color: #C7855E; }

      .footer {
        text-align: center; font-size: 13px; color: #6B6157;
        padding: 24px;
        background: #FFF9F5;
      }
      .footer p { margin: 6px 0; }
    </style>
  </head>
  <body style="background:#F6F1EA; margin:0; padding:0;">
    <div class="wrapper" style="background:#F6F1EA;">
      <div class="container" style="background:#FFFFFF;">
        <div class="header">
          <img src="https://zagkvtxarndluusiluhb.supabase.co/storage/v1/object/public/home-media/logo-white.png" alt="Music Lovely"/>
        </div>

        <div class="content">
          <h2>¡Pago Confirmado!</h2>
          <p>Hola <strong>{{customer_name}}</strong>,</p>
          <p>
            ¡Hemos recibido tu pago y ya comenzamos a crear una canción personalizada increíble para <strong>{{recipient_name}}</strong>! 🎵
          </p>

          <div class="info-box">
            <p><strong>📋 Número de Pedido:</strong> {{order_id}}</p>
            <p><strong>🎸 Estilo Musical:</strong> {{music_style}}</p>
            <p><strong>⏰ Previsión de Entrega:</strong> {{delivery_time}}</p>
          </div>

          <p>
            Nuestra IA está trabajando para componer una canción única basada en la información que proporcionaste. 
            Recibirás un nuevo email tan pronto como tu música esté lista para descargar.
          </p>

          <p style="color:#6B6157; font-size:14px; margin-top:24px;">
            ¡Gracias por elegir <strong>Music Lovely</strong> para crear momentos especiales! ❤️
          </p>
        </div>

        <div class="footer">
          <p>© 2025 Music Lovely — <a href="https://musiclovely.com" style="color:#C7855E;">musiclovely.com</a></p>
          <p>Este es un email automático. Si tienes alguna duda, contáctanos.</p>
        </div>
      </div>
    </div>
  </body>
</html>',
  '["customer_name", "recipient_name", "order_id", "music_style", "delivery_time"]'::jsonb,
  'Music Lovely',
  'no-reply@musiclovely.com'
);

-- Template: music_released (Espanhol)
INSERT INTO email_templates_es (
  template_type,
  subject,
  html_content,
  variables,
  from_name,
  from_email
) VALUES (
  'music_released',
  '🎵 ¡Tu Música Está Lista para Descargar!',
  '<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Tu Música Está Lista | Music Lovely</title>
    <style>
      body {
        margin: 0; padding: 0;
        background: #F5F0EB;
        color: #362E26;
        -webkit-text-size-adjust: 100%;
        -ms-text-size-adjust: 100%;
        font-family: Inter, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      }
      a { color: #C18B67; text-decoration: none; }
      img { border: 0; line-height: 100%; outline: none; text-decoration: none; max-width: 100%; height: auto; }

      .wrapper {
        width: 100%;
        background: #F5F0EB;
        padding: 24px 0;
      }
      .container {
        width: 100%;
        max-width: 620px;
        margin: 0 auto;
        background: #FFFFFF;
        border-radius: 16px;
        box-shadow: 0 2px 14px rgba(0,0,0,0.08);
        overflow: hidden;
      }

      .header {
        padding: 32px 20px;
        text-align: center;
        color: #FFFFFF;
        background: linear-gradient(135deg, #E7CC9D 0%, #C18B67 50%, #B07954 100%);
      }
      .header img {
        max-width: 200px;
        height: auto;
        display: inline-block;
      }

      .content { padding: 30px; line-height: 1.6; }
      .content h2 { margin: 0 0 10px; font-size: 22px; color: #362E26; }
      .content p { margin: 0 0 18px; font-size: 16px; color: #362E26; }

      .song-preview {
        background: #FBF8F4;
        border: 1px solid #E6DED6;
        border-left: 4px solid #C18B67;
        border-radius: 10px;
        padding: 18px;
        margin: 18px 0;
      }
      .song-preview p { margin: 6px 0; }
      .song-preview strong { color: #C18B67; }

      .cover-img {
        text-align: center;
        margin: 30px 0;
      }
      .cover-img img {
        max-width: 100%;
        height: auto;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      }

      .cta-wrapper { text-align: center; margin: 22px 0 6px; }
      .button {
        display: inline-block; 
        padding: 14px 28px;
        background: #C18B67; 
        color: #FFFFFF !important;
        border-radius: 10px; 
        font-weight: 600;
        margin: 10px 5px;
      }
      .button:hover { filter: brightness(0.95); }

      .tip-box {
        background: #FFF9F0;
        border: 1px solid #F4E4C1;
        border-left: 4px solid #E7CC9D;
        border-radius: 10px;
        padding: 16px;
        margin: 24px 0;
        text-align: center;
      }

      .footer {
        text-align: center; 
        font-size: 13px; 
        color: #6B6157;
        padding: 22px 24px;
      }

      @media (prefers-color-scheme: dark) {
        body, .wrapper { background: #362E26 !important; color: #F5F0EB !important; }
        .container { background: #413830 !important; }
        .content h2, .content p { color: #F5F0EB !important; }
        .song-preview { background: #494036 !important; border-color: #584C41 !important; }
        .tip-box { background: #494036 !important; border-color: #584C41 !important; }
        .footer { color: #AD9985 !important; }
      }
    </style>
  </head>
  <body style="background:#F5F0EB; margin:0; padding:0;">
    <div class="wrapper" style="background:#F5F0EB;">
      <div class="container" style="background:#FFFFFF;">
        <div class="header">
          <img src="https://zagkvtxarndluusiluhb.supabase.co/storage/v1/object/public/home-media/logo-white.png" alt="Music Lovely - Crea tu música personalizada" width="120" style="display: block; margin: 0 auto; max-width: 120px; height: auto; border: 0; outline: none;" loading="eager">
        </div>

        <div class="content">
          <h2>🎉 ¡Tu música está lista!</h2>
          <p>Hola <strong>{{customer_name}}</strong>,</p>
          <p>¡Tu canción personalizada para <strong>{{recipient_name}}</strong> fue creada con mucho cariño y ya está disponible para descargar!</p>

          <div class="cover-img">
            <img src="{{cover_url}}" alt="Portada de la música" />
          </div>

          <div class="song-preview">
            <p><strong>Estilo:</strong> {{music_style}}</p>
            <p><strong>Duración:</strong> {{duration}}</p>
            <p><strong>Lanzado el:</strong> {{release_date}}</p>
          </div>

          <div class="cta-wrapper">
            <p style="margin-bottom: 20px; font-weight: 600;">Elige tu versión preferida:</p>
            <a href="{{download_url_1}}" class="button">🎵 Descargar Versión 1</a>
            <a href="{{download_url_2}}" class="button">🎵 Descargar Versión 2</a>
          </div>

          <div class="tip-box">
            <p style="margin: 0; font-size: 15px; color: #C18B67; font-weight: 600;">
              ✨ Consejo: Esta canción fue creada especialmente para ti. ¡Comparte este momento único con quienes amas!
            </p>
          </div>

          <p style="color: #6B6157; font-size: 14px; margin-top: 30px;">
            ¡Esperamos que disfrutes tu música personalizada! Si tienes alguna pregunta, estamos aquí para ayudarte.
          </p>
        </div>

        <div class="footer">
          <p>© 2025 Music Lovely — <a href="https://musiclovely.com" style="color:#C18B67;">musiclovely.com</a></p>
          <p>Este es un email automático. Para soporte, responde este email.</p>
        </div>
      </div>
    </div>
  </body>
</html>',
  '["customer_name", "recipient_name", "music_style", "duration", "release_date", "cover_url", "download_url_1", "download_url_2"]'::jsonb,
  'Music Lovely',
  'no-reply@musiclovely.com'
);

-- 8. VERIFICAR RESULTADO
SELECT 
  'TABELAS CRIADAS COM SUCESSO' as status,
  'email_templates_pt' as tabela_pt,
  'email_templates_en' as tabela_en,
  'email_templates_es' as tabela_es,
  COUNT(*) as total_templates_pt
FROM email_templates_pt
UNION ALL
SELECT 
  'TEMPLATES INGLESES' as status,
  'order_paid' as template_type,
  'music_released' as template_type_2,
  'TOTAL' as total,
  COUNT(*) as total_templates_en
FROM email_templates_en
UNION ALL
SELECT 
  'TEMPLATES ESPANHOIS' as status,
  'order_paid' as template_type,
  'music_released' as template_type_2,
  'TOTAL' as total,
  COUNT(*) as total_templates_es
FROM email_templates_es;
