import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

export type SupportedLanguage = 'pt' | 'en' | 'es';

/**
 * Detecta o idioma de um pedido baseado em múltiplas fontes
 * @param supabase - Cliente Supabase
 * @param orderId - ID do pedido
 * @returns Idioma detectado ('pt', 'en', 'es')
 */
export async function detectLanguageFromOrder(
  supabase: any,
  orderId: string
): Promise<SupportedLanguage> {
  console.log(`🌍 [LanguageDetector] Detectando idioma para pedido: ${orderId}`);

  try {
    // ✅ OTIMIZAÇÃO: Buscar order e email_logs em paralelo
    const [orderResult, emailLogResult] = await Promise.all([
      supabase
        .from('orders')
        .select('id, customer_email, quiz_id')
        .eq('id', orderId)
        .single(),
      supabase
      .from('email_logs')
      .select('template_used, sent_at')
      .eq('order_id', orderId)
      .eq('email_type', 'order_paid')
      .eq('status', 'delivered')
      .order('sent_at', { ascending: false })
      .limit(1)
        .maybeSingle()
    ]);

    // PRIORIDADE 0: Idioma do email order_paid anterior
    if (!emailLogResult.error && emailLogResult.data?.template_used) {
      const previousEmail = emailLogResult.data;
      console.log('📧 [LanguageDetector] Email order_paid anterior encontrado:', {
        template_used: previousEmail.template_used,
        sent_at: previousEmail.sent_at
      });
      
      // Extrair idioma do template_used (ex: "order_paid_pt" -> "pt")
      const languageMatch = previousEmail.template_used.match(/_([a-z]{2})$/);
      if (languageMatch && ['pt', 'en', 'es'].includes(languageMatch[1])) {
        const language = languageMatch[1];
        console.log(`✅ [LanguageDetector] Idioma do email anterior: ${language}`);
        return language as SupportedLanguage;
      }
    }

    // Verificar se order foi encontrado
    if (orderResult.error || !orderResult.data) {
      console.error('❌ [LanguageDetector] Erro ao buscar pedido:', orderResult.error);
      return 'en'; // Fallback inglês
    }

    const order = orderResult.data;
    console.log('📦 [LanguageDetector] Pedido encontrado:', {
      orderId: order.id,
      customerEmail: order.customer_email,
      quizId: order.quiz_id || null
    });

    // PRIORIDADE 1: Idioma do quiz (se existir)
    if (order.quiz_id) {
      const { data: quiz, error: quizErr } = await supabase
        .from('quizzes')
        .select('id, language')
        .eq('id', order.quiz_id)
        .single();

      if (!quizErr && quiz?.language && ['pt', 'en', 'es'].includes(quiz.language)) {
        console.log(`✅ [LanguageDetector] Idioma do quiz: ${quiz.language}`);
        return quiz.language as SupportedLanguage;
      }
    }

    // PRIORIDADE 2: Detecção por domínio de email (instantâneo, sem query)
    const detectedLanguage = detectLanguageByEmailDomain(order.customer_email);
    console.log(`🔍 [LanguageDetector] Idioma por email: ${detectedLanguage}`);
    return detectedLanguage;

  } catch (error) {
    console.error('❌ [LanguageDetector] Erro na detecção:', error);
    return 'en'; // Fallback inglês
  }
}

/**
 * Detecta idioma baseado no domínio do email
 * @param email - Email do cliente
 * @returns Idioma detectado
 */
function detectLanguageByEmailDomain(email: string): SupportedLanguage {
  if (!email) return 'en';
  
  const domain = email.toLowerCase().split('@')[1] || '';

  console.log(`🔍 [LanguageDetector] Analisando domínio: ${domain}`);

  // Domínios que indicam português
  if (domain.includes('.br') || domain.includes('.com.br') || domain.includes('.pt')) {
    return 'pt';
  }

  // Domínios que indicam espanhol
  if (domain.includes('.es') || domain.includes('.mx') || domain.includes('.ar') || 
      domain.includes('.co') || domain.includes('.cl') || domain.includes('.pe') ||
      domain.includes('.ve') || domain.includes('.uy') || domain.includes('.py') ||
      domain.includes('.bo') || domain.includes('.ec') || domain.includes('.gt') ||
      domain.includes('.hn') || domain.includes('.ni') || domain.includes('.pa') ||
      domain.includes('.sv') || domain.includes('.cr') || domain.includes('.do')) {
    return 'es';
  }

  // Domínios que indicam inglês (principalmente .com, .org, .net, etc.)
  if (domain.includes('.com') || domain.includes('.org') || domain.includes('.net') ||
      domain.includes('.edu') || domain.includes('.gov') || domain.includes('.uk') ||
      domain.includes('.ca') || domain.includes('.au') || domain.includes('.nz') ||
      domain.includes('.ie') || domain.includes('.za') || domain.includes('.in')) {
    return 'en';
  }

  // Fallback: Inglês (para .com, .uk, .ca, .au, etc)
  return 'en';
}

/**
 * Busca template multilíngue com fallback robusto em cascata
 * @param supabase - Cliente Supabase
 * @param templateType - Tipo do template
 * @param language - Idioma desejado
 * @returns Template encontrado ou fallback
 */
export async function getMultilingualTemplate(
  supabase: any,
  templateType: string,
  language: SupportedLanguage
): Promise<any> {
  console.log(`📧 [LanguageDetector] Buscando template ${templateType} em ${language}`);

  try {
    // 1. Buscar template no idioma solicitado na tabela unificada
    console.log(`🔍 [LanguageDetector] Buscando na tabela unificada: email_templates_i18n`);

    const { data: template, error: templateError } = await supabase
      .from('email_templates_i18n')
      .select('*')
      .eq('template_type', templateType)
      .eq('language', language)
      .single();

    if (!templateError && template) {
      console.log(`✅ [LanguageDetector] Template encontrado: ${templateType}_${language}`);
      return template;
    }

    console.warn(`⚠️ [LanguageDetector] Template ${templateType}_${language} não encontrado, tentando fallback...`);

    // 2. Fallback: Português (padrão)
    if (language !== 'pt') {
      console.log(`🔄 [LanguageDetector] Tentando fallback português...`);
      const { data: ptTemplate, error: ptError } = await supabase
        .from('email_templates_i18n')
        .select('*')
        .eq('template_type', templateType)
        .eq('language', 'pt')
        .single();

      if (!ptError && ptTemplate) {
        console.log(`✅ [LanguageDetector] Usando template fallback em português`);
        return ptTemplate;
      }
      console.warn(`⚠️ [LanguageDetector] Template português também não encontrado`);
    }

    // 3. Fallback final: Template genérico em memória
    console.log(`🔄 [LanguageDetector] Criando template genérico em memória...`);
    return createGenericTemplate(templateType, language);

  } catch (error) {
    console.error('❌ [LanguageDetector] Erro ao buscar template:', error);
    
    // Último recurso: template genérico
    console.log(`🆘 [LanguageDetector] Usando template genérico como último recurso`);
    return createGenericTemplate(templateType, language);
  }
}

/**
 * Cria template genérico em memória como último recurso
 * @param templateType - Tipo do template
 * @param language - Idioma desejado
 * @returns Template genérico
 */
function createGenericTemplate(templateType: string, language: SupportedLanguage): any {
  console.log(`🆘 [LanguageDetector] Criando template genérico para ${templateType} em ${language}`);
  
  const templates = {
    order_paid: {
      pt: {
        subject: '🎵 Pedido Confirmado - Music Lovely',
        html_content: '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family: Arial, sans-serif; padding: 20px;"><h1>Pedido Confirmado!</h1><p>Olá {{customer_name}}, seu pedido foi confirmado com sucesso!</p><p>Obrigado por escolher o Music Lovely!</p></body></html>',
        variables: ['customer_name', 'order_id', 'plan', 'about_who', 'style', 'release_date']
      },
      en: {
        subject: '🎵 Order Confirmed - Music Lovely',
        html_content: '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family: Arial, sans-serif; padding: 20px;"><h1>Order Confirmed!</h1><p>Hello {{customer_name}}, your order has been successfully confirmed!</p><p>Thank you for choosing Music Lovely!</p></body></html>',
        variables: ['customer_name', 'order_id', 'plan', 'about_who', 'style', 'release_date']
      },
      es: {
        subject: '🎵 Pedido Confirmado - Music Lovely',
        html_content: '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family: Arial, sans-serif; padding: 20px;"><h1>¡Pedido Confirmado!</h1><p>¡Hola {{customer_name}}, tu pedido ha sido confirmado exitosamente!</p><p>¡Gracias por elegir Music Lovely!</p></body></html>',
        variables: ['customer_name', 'order_id', 'plan', 'about_who', 'style', 'release_date']
      }
    },
    music_released: {
      pt: {
        subject: '🎵 Sua música está pronta! - Music Lovely',
        html_content: '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family: Arial, sans-serif; padding: 20px;"><h1>Sua música está pronta!</h1><p>Olá {{customer_name}}, sua música personalizada está pronta para download!</p><p>Clique aqui para baixar: {{download_url}}</p></body></html>',
        variables: ['customer_name', 'song_title', 'style', 'duration', 'download_url']
      },
      en: {
        subject: '🎵 Your music is ready! - Music Lovely',
        html_content: '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family: Arial, sans-serif; padding: 20px;"><h1>Your music is ready!</h1><p>Hello {{customer_name}}, your personalized music is ready for download!</p><p>Click here to download: {{download_url}}</p></body></html>',
        variables: ['customer_name', 'song_title', 'style', 'duration', 'download_url']
      },
      es: {
        subject: '🎵 ¡Tu música está lista! - Music Lovely',
        html_content: '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family: Arial, sans-serif; padding: 20px;"><h1>¡Tu música está lista!</h1><p>¡Hola {{customer_name}}, tu música personalizada está lista para descargar!</p><p>Haz clic aquí para descargar: {{download_url}}</p></body></html>',
        variables: ['customer_name', 'song_title', 'style', 'duration', 'download_url']
      }
    },
    failed_notification: {
      pt: {
        subject: '⚠️ Problema com seu pedido - Music Lovely',
        html_content: '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family: Arial, sans-serif; padding: 20px;"><h1>Problema com seu pedido</h1><p>Olá {{customer_name}}, encontramos um problema ao processar sua música.</p><p>Erro: {{error_message}}</p><p>Você receberá um reembolso automático.</p></body></html>',
        variables: ['customer_name', 'error_message']
      },
      en: {
        subject: '⚠️ Problem with your order - Music Lovely',
        html_content: '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family: Arial, sans-serif; padding: 20px;"><h1>Problem with your order</h1><p>Hello {{customer_name}}, we encountered a problem processing your music.</p><p>Error: {{error_message}}</p><p>You will receive an automatic refund.</p></body></html>',
        variables: ['customer_name', 'error_message']
      },
      es: {
        subject: '⚠️ Problema con tu pedido - Music Lovely',
        html_content: '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family: Arial, sans-serif; padding: 20px;"><h1>Problema con tu pedido</h1><p>Hola {{customer_name}}, encontramos un problema al procesar tu música.</p><p>Error: {{error_message}}</p><p>Recibirás un reembolso automático.</p></body></html>',
        variables: ['customer_name', 'error_message']
      }
    }
  };

  const template = templates[templateType]?.[language] || templates[templateType]?.en || {
    subject: `🎵 ${templateType} - Music Lovely`,
    html_content: '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family: Arial, sans-serif; padding: 20px;"><h1>Music Lovely</h1><p>Hello {{customer_name}}, this is an automated message from Music Lovely.</p></body></html>',
    variables: ['customer_name']
  };

  // Usar suporte@musiclovely.com para todos os templates
  const fromEmail = 'suporte@musiclovely.com';

  return {
    id: 'generic-template',
    template_type: templateType,
    subject: template.subject,
    html_content: template.html_content,
    variables: template.variables,
    from_name: 'Music Lovely',
    from_email: fromEmail,
    reply_to: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

/**
 * Logs detalhados para debug
 */
export function logLanguageDetection(
  orderId: string,
  detectedLanguage: SupportedLanguage,
  source: string,
  customerEmail?: string
) {
  console.log(`🌍 [LanguageDetector] Resultado da detecção:`, {
    orderId,
    detectedLanguage,
    source,
    customerEmail,
    timestamp: new Date().toISOString()
  });
  
  // Log específico para cada fonte de detecção
  const sourceEmojis = {
    'previous_email': '📧',
    'quiz': '🧩', 
    'email_domain': '🌐',
    'fallback': '🔄'
  };
  
  const emoji = sourceEmojis[source as keyof typeof sourceEmojis] || '🔍';
  console.log(`${emoji} [LanguageDetector] Idioma ${detectedLanguage} detectado via ${source} para ${orderId}`);
}
