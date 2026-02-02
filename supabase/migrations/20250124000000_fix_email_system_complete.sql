-- ==========================================
-- CORREÇÃO COMPLETA DO SISTEMA DE EMAILS MULTILÍNGUE
-- Migration consolidada que resolve todos os problemas
-- ==========================================

-- 1. DROPAR TODAS AS TABELAS DE EMAIL EXISTENTES
DROP TABLE IF EXISTS email_templates CASCADE;
DROP TABLE IF EXISTS email_templates_i18n CASCADE;
DROP TABLE IF EXISTS email_templates_pt CASCADE;
DROP TABLE IF EXISTS email_templates_en CASCADE;
DROP TABLE IF EXISTS email_templates_es CASCADE;

-- 2. DROPAR POLÍTICAS RLS SE EXISTIREM
DO $$
BEGIN
    -- Tentar dropar políticas se as tabelas existirem
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_templates_i18n') THEN
        DROP POLICY IF EXISTS "Allow public read access" ON email_templates_i18n;
        DROP POLICY IF EXISTS "Allow service role full access" ON email_templates_i18n;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_templates_pt') THEN
        DROP POLICY IF EXISTS "Allow public read access pt" ON email_templates_pt;
        DROP POLICY IF EXISTS "Allow service role full access pt" ON email_templates_pt;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_templates_en') THEN
        DROP POLICY IF EXISTS "Allow public read access en" ON email_templates_en;
        DROP POLICY IF EXISTS "Allow service role full access en" ON email_templates_en;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_templates_es') THEN
        DROP POLICY IF EXISTS "Allow public read access es" ON email_templates_es;
        DROP POLICY IF EXISTS "Allow service role full access es" ON email_templates_es;
    END IF;
END $$;

-- 3. DROPAR ÍNDICES SE EXISTIREM
DROP INDEX IF EXISTS idx_email_templates_i18n_template_type;
DROP INDEX IF EXISTS idx_email_templates_i18n_language;
DROP INDEX IF EXISTS idx_email_templates_i18n_template_lang;

-- 4. CRIAR AS 3 TABELAS PRINCIPAIS COM ESTRUTURA COMPLETA

-- Tabela Português
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

-- Tabela Inglês
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

-- Tabela Espanhol
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

-- 5. CONFIGURAR RLS
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

-- 6. POPULAR TEMPLATES INICIAIS

-- TEMPLATES EM PORTUGUÊS
INSERT INTO email_templates_pt (template_type, subject, html_content, variables, from_name, from_email) VALUES
(
  'order_paid',
  '🎵 Pedido Confirmado - Sua música está sendo criada!',
  '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Pedido Confirmado</title></head><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;"><div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;"><h1 style="color: white; margin: 0; font-size: 28px;">🎵 Music Lovely</h1><h2 style="color: white; margin: 10px 0 0 0; font-size: 24px; font-weight: normal;">Pedido Confirmado!</h2></div><div style="background: #f8f9fa; padding: 30px; border-radius: 10px; margin-bottom: 20px;"><h3 style="color: #333; margin-top: 0;">Olá {{customer_name}}!</h3><p>Seu pagamento foi confirmado com sucesso! 🎉</p><div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;"><h4 style="margin: 0 0 10px 0; color: #28a745;">📋 Detalhes do Pedido</h4><p style="margin: 5px 0;"><strong>ID do Pedido:</strong> {{order_id}}</p><p style="margin: 5px 0;"><strong>Plano:</strong> {{plan}}</p><p style="margin: 5px 0;"><strong>Sobre:</strong> {{about_who}}</p><p style="margin: 5px 0;"><strong>Estilo:</strong> {{style}}</p><p style="margin: 5px 0;"><strong>Data de Entrega:</strong> {{release_date}}</p></div><p>Nossa equipe de compositores já começou a trabalhar na sua música personalizada! 🎼</p><p>Você receberá um email quando sua música estiver pronta para download.</p></div><div style="text-align: center; margin: 30px 0;"><a href="https://musiclovely.com" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold;">Visitar Music Lovely</a></div><div style="text-align: center; color: #666; font-size: 14px; margin-top: 30px;"><p>Obrigado por escolher o Music Lovely! 🎵</p><p>Se você tiver alguma dúvida, entre em contato conosco.</p></div></body></html>',
  '["customer_name", "order_id", "plan", "about_who", "style", "release_date"]'::jsonb,
  'Music Lovely',
  'no-reply@musiclovely.com'
),
(
  'music_released',
  '🎵 Sua música está pronta! - Music Lovely',
  '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Música Pronta</title></head><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;"><div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;"><h1 style="color: white; margin: 0; font-size: 28px;">🎵 Music Lovely</h1><h2 style="color: white; margin: 10px 0 0 0; font-size: 24px; font-weight: normal;">Sua música está pronta!</h2></div><div style="background: #f8f9fa; padding: 30px; border-radius: 10px; margin-bottom: 20px;"><h3 style="color: #333; margin-top: 0;">Parabéns {{customer_name}}! 🎉</h3><p>Sua música personalizada está pronta para download!</p><div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;"><h4 style="margin: 0 0 10px 0; color: #28a745;">🎼 Detalhes da Música</h4><p style="margin: 5px 0;"><strong>Título:</strong> {{song_title}}</p><p style="margin: 5px 0;"><strong>Estilo:</strong> {{style}}</p><p style="margin: 5px 0;"><strong>Duração:</strong> {{duration}}</p></div><p>Clique no botão abaixo para baixar sua música:</p></div><div style="text-align: center; margin: 30px 0;"><a href="{{download_url}}" style="background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold; font-size: 18px;">⬇️ Baixar Música</a></div><div style="text-align: center; color: #666; font-size: 14px; margin-top: 30px;"><p>Obrigado por escolher o Music Lovely! 🎵</p><p>Se você tiver alguma dúvida, entre em contato conosco.</p></div></body></html>',
  '["customer_name", "song_title", "style", "duration", "download_url"]'::jsonb,
  'Music Lovely',
  'no-reply@musiclovely.com'
),
(
  'failed_notification',
  '⚠️ Problema com seu pedido - Music Lovely',
  '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Problema no Pedido</title></head><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;"><div style="background: linear-gradient(135deg, #dc3545 0%, #e74c3c 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;"><h1 style="color: white; margin: 0; font-size: 28px;">🎵 Music Lovely</h1><h2 style="color: white; margin: 10px 0 0 0; font-size: 24px; font-weight: normal;">Problema com seu pedido</h2></div><div style="background: #f8f9fa; padding: 30px; border-radius: 10px; margin-bottom: 20px;"><h3 style="color: #333; margin-top: 0;">Olá {{customer_name}},</h3><p>Infelizmente, encontramos um problema ao processar sua música personalizada.</p><div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;"><h4 style="margin: 0 0 10px 0; color: #856404;">⚠️ Problema Identificado</h4><p style="margin: 5px 0; color: #856404;">{{error_message}}</p></div><p>Nossa equipe está trabalhando para resolver este problema o mais rápido possível.</p><p>Você receberá um reembolso automático em até 5 dias úteis.</p></div><div style="text-align: center; margin: 30px 0;"><a href="https://musiclovely.com" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold;">Visitar Music Lovely</a></div><div style="text-align: center; color: #666; font-size: 14px; margin-top: 30px;"><p>Pedimos desculpas pelo inconveniente.</p><p>Se você tiver alguma dúvida, entre em contato conosco.</p></div></body></html>',
  '["customer_name", "error_message"]'::jsonb,
  'Music Lovely',
  'no-reply@musiclovely.com'
);

-- TEMPLATES EM INGLÊS
INSERT INTO email_templates_en (template_type, subject, html_content, variables, from_name, from_email) VALUES
(
  'order_paid',
  '🎵 Order Confirmed - Your music is being created!',
  '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Order Confirmed</title></head><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;"><div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;"><h1 style="color: white; margin: 0; font-size: 28px;">🎵 Music Lovely</h1><h2 style="color: white; margin: 10px 0 0 0; font-size: 24px; font-weight: normal;">Order Confirmed!</h2></div><div style="background: #f8f9fa; padding: 30px; border-radius: 10px; margin-bottom: 20px;"><h3 style="color: #333; margin-top: 0;">Hello {{customer_name}}!</h3><p>Your payment has been successfully confirmed! 🎉</p><div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;"><h4 style="margin: 0 0 10px 0; color: #28a745;">📋 Order Details</h4><p style="margin: 5px 0;"><strong>Order ID:</strong> {{order_id}}</p><p style="margin: 5px 0;"><strong>Plan:</strong> {{plan}}</p><p style="margin: 5px 0;"><strong>About:</strong> {{about_who}}</p><p style="margin: 5px 0;"><strong>Style:</strong> {{style}}</p><p style="margin: 5px 0;"><strong>Delivery Date:</strong> {{release_date}}</p></div><p>Our team of composers has already started working on your personalized music! 🎼</p><p>You will receive an email when your music is ready for download.</p></div><div style="text-align: center; margin: 30px 0;"><a href="https://musiclovely.com" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold;">Visit Music Lovely</a></div><div style="text-align: center; color: #666; font-size: 14px; margin-top: 30px;"><p>Thank you for choosing Music Lovely! 🎵</p><p>If you have any questions, please contact us.</p></div></body></html>',
  '["customer_name", "order_id", "plan", "about_who", "style", "release_date"]'::jsonb,
  'Music Lovely',
  'no-reply@musiclovely.com'
),
(
  'music_released',
  '🎵 Your music is ready! - Music Lovely',
  '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Music Ready</title></head><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;"><div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;"><h1 style="color: white; margin: 0; font-size: 28px;">🎵 Music Lovely</h1><h2 style="color: white; margin: 10px 0 0 0; font-size: 24px; font-weight: normal;">Your music is ready!</h2></div><div style="background: #f8f9fa; padding: 30px; border-radius: 10px; margin-bottom: 20px;"><h3 style="color: #333; margin-top: 0;">Congratulations {{customer_name}}! 🎉</h3><p>Your personalized music is ready for download!</p><div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;"><h4 style="margin: 0 0 10px 0; color: #28a745;">🎼 Music Details</h4><p style="margin: 5px 0;"><strong>Title:</strong> {{song_title}}</p><p style="margin: 5px 0;"><strong>Style:</strong> {{style}}</p><p style="margin: 5px 0;"><strong>Duration:</strong> {{duration}}</p></div><p>Click the button below to download your music:</p></div><div style="text-align: center; margin: 30px 0;"><a href="{{download_url}}" style="background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold; font-size: 18px;">⬇️ Download Music</a></div><div style="text-align: center; color: #666; font-size: 14px; margin-top: 30px;"><p>Thank you for choosing Music Lovely! 🎵</p><p>If you have any questions, please contact us.</p></div></body></html>',
  '["customer_name", "song_title", "style", "duration", "download_url"]'::jsonb,
  'Music Lovely',
  'no-reply@musiclovely.com'
),
(
  'failed_notification',
  '⚠️ Problem with your order - Music Lovely',
  '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Order Problem</title></head><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;"><div style="background: linear-gradient(135deg, #dc3545 0%, #e74c3c 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;"><h1 style="color: white; margin: 0; font-size: 28px;">🎵 Music Lovely</h1><h2 style="color: white; margin: 10px 0 0 0; font-size: 24px; font-weight: normal;">Problem with your order</h2></div><div style="background: #f8f9fa; padding: 30px; border-radius: 10px; margin-bottom: 20px;"><h3 style="color: #333; margin-top: 0;">Hello {{customer_name}},</h3><p>Unfortunately, we encountered a problem processing your personalized music.</p><div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;"><h4 style="margin: 0 0 10px 0; color: #856404;">⚠️ Problem Identified</h4><p style="margin: 5px 0; color: #856404;">{{error_message}}</p></div><p>Our team is working to resolve this issue as quickly as possible.</p><p>You will receive an automatic refund within 5 business days.</p></div><div style="text-align: center; margin: 30px 0;"><a href="https://musiclovely.com" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold;">Visit Music Lovely</a></div><div style="text-align: center; color: #666; font-size: 14px; margin-top: 30px;"><p>We apologize for the inconvenience.</p><p>If you have any questions, please contact us.</p></div></body></html>',
  '["customer_name", "error_message"]'::jsonb,
  'Music Lovely',
  'no-reply@musiclovely.com'
);

-- TEMPLATES EM ESPANHOL
INSERT INTO email_templates_es (template_type, subject, html_content, variables, from_name, from_email) VALUES
(
  'order_paid',
  '🎵 Pedido Confirmado - ¡Tu música está siendo creada!',
  '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Pedido Confirmado</title></head><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;"><div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;"><h1 style="color: white; margin: 0; font-size: 28px;">🎵 Music Lovely</h1><h2 style="color: white; margin: 10px 0 0 0; font-size: 24px; font-weight: normal;">¡Pedido Confirmado!</h2></div><div style="background: #f8f9fa; padding: 30px; border-radius: 10px; margin-bottom: 20px;"><h3 style="color: #333; margin-top: 0;">¡Hola {{customer_name}}!</h3><p>¡Tu pago ha sido confirmado exitosamente! 🎉</p><div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;"><h4 style="margin: 0 0 10px 0; color: #28a745;">📋 Detalles del Pedido</h4><p style="margin: 5px 0;"><strong>ID del Pedido:</strong> {{order_id}}</p><p style="margin: 5px 0;"><strong>Plan:</strong> {{plan}}</p><p style="margin: 5px 0;"><strong>Sobre:</strong> {{about_who}}</p><p style="margin: 5px 0;"><strong>Estilo:</strong> {{style}}</p><p style="margin: 5px 0;"><strong>Fecha de Entrega:</strong> {{release_date}}</p></div><p>¡Nuestro equipo de compositores ya comenzó a trabajar en tu música personalizada! 🎼</p><p>Recibirás un email cuando tu música esté lista para descargar.</p></div><div style="text-align: center; margin: 30px 0;"><a href="https://musiclovely.com" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold;">Visitar Music Lovely</a></div><div style="text-align: center; color: #666; font-size: 14px; margin-top: 30px;"><p>¡Gracias por elegir Music Lovely! 🎵</p><p>Si tienes alguna pregunta, contáctanos.</p></div></body></html>',
  '["customer_name", "order_id", "plan", "about_who", "style", "release_date"]'::jsonb,
  'Music Lovely',
  'no-reply@musiclovely.com'
),
(
  'music_released',
  '🎵 ¡Tu música está lista! - Music Lovely',
  '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Música Lista</title></head><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;"><div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;"><h1 style="color: white; margin: 0; font-size: 28px;">🎵 Music Lovely</h1><h2 style="color: white; margin: 10px 0 0 0; font-size: 24px; font-weight: normal;">¡Tu música está lista!</h2></div><div style="background: #f8f9fa; padding: 30px; border-radius: 10px; margin-bottom: 20px;"><h3 style="color: #333; margin-top: 0;">¡Felicitaciones {{customer_name}}! 🎉</h3><p>¡Tu música personalizada está lista para descargar!</p><div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;"><h4 style="margin: 0 0 10px 0; color: #28a745;">🎼 Detalles de la Música</h4><p style="margin: 5px 0;"><strong>Título:</strong> {{song_title}}</p><p style="margin: 5px 0;"><strong>Estilo:</strong> {{style}}</p><p style="margin: 5px 0;"><strong>Duración:</strong> {{duration}}</p></div><p>Haz clic en el botón de abajo para descargar tu música:</p></div><div style="text-align: center; margin: 30px 0;"><a href="{{download_url}}" style="background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold; font-size: 18px;">⬇️ Descargar Música</a></div><div style="text-align: center; color: #666; font-size: 14px; margin-top: 30px;"><p>¡Gracias por elegir Music Lovely! 🎵</p><p>Si tienes alguna pregunta, contáctanos.</p></div></body></html>',
  '["customer_name", "song_title", "style", "duration", "download_url"]'::jsonb,
  'Music Lovely',
  'no-reply@musiclovely.com'
),
(
  'failed_notification',
  '⚠️ Problema con tu pedido - Music Lovely',
  '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Problema en el Pedido</title></head><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;"><div style="background: linear-gradient(135deg, #dc3545 0%, #e74c3c 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;"><h1 style="color: white; margin: 0; font-size: 28px;">🎵 Music Lovely</h1><h2 style="color: white; margin: 10px 0 0 0; font-size: 24px; font-weight: normal;">Problema con tu pedido</h2></div><div style="background: #f8f9fa; padding: 30px; border-radius: 10px; margin-bottom: 20px;"><h3 style="color: #333; margin-top: 0;">Hola {{customer_name}},</h3><p>Desafortunadamente, encontramos un problema al procesar tu música personalizada.</p><div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;"><h4 style="margin: 0 0 10px 0; color: #856404;">⚠️ Problema Identificado</h4><p style="margin: 5px 0; color: #856404;">{{error_message}}</p></div><p>Nuestro equipo está trabajando para resolver este problema lo más rápido posible.</p><p>Recibirás un reembolso automático en hasta 5 días hábiles.</p></div><div style="text-align: center; margin: 30px 0;"><a href="https://musiclovely.com" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold;">Visitar Music Lovely</a></div><div style="text-align: center; color: #666; font-size: 14px; margin-top: 30px;"><p>Pedimos disculpas por las molestias.</p><p>Si tienes alguna pregunta, contáctanos.</p></div></body></html>',
  '["customer_name", "error_message"]'::jsonb,
  'Music Lovely',
  'no-reply@musiclovely.com'
);

-- 7. VERIFICAR RESULTADO
SELECT 
  'MIGRATION COMPLETA' as status,
  '3 tabelas criadas e populadas: email_templates_pt, email_templates_en, email_templates_es' as message,
  NOW() as executed_at;
