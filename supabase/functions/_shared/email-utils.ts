import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getEmailHeaders, addHeadersToResendPayload } from "./email-headers.ts";
import { validateEmailForSending, normalizeEmail } from "./email-validator.ts";
import { checkAllRateLimits, applySendDelay, type RateLimitConfig } from "./email-rate-limiter.ts";
import { improveEmailContent } from "./email-content-improver.ts";

interface EmailTemplate {
  id: string;
  template_type: string;
  subject: string;
  html_content: string;
  from_name: string;
  from_email: string;
  reply_to?: string;
  variables: string[];
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string; // Versão texto do email
  from?: string; // Formato: "Name <email@domain.com>"
  replyTo?: string;
  tags?: Array<{ name: string; value: string }>;
  orderId?: string;
  songId?: string;
  templateType?: string;
  language?: string;
  variables?: Record<string, any>;
  skipValidation?: boolean; // Pular validação (usar com cuidado)
  skipRateLimit?: boolean; // Pular rate limit (usar com cuidado)
  rateLimitConfig?: RateLimitConfig;
  baseUrl?: string; // URL base para unsubscribe links
  enableAvatar?: boolean; // Se true, permite exibição de avatar (Gravatar). Padrão: true
}

export async function getEmailTemplate(
  supabaseClient: SupabaseClient,
  templateType: string
): Promise<EmailTemplate> {
  const { data, error } = await supabaseClient
    .from('email_templates')
    .select('*')
    .eq('template_type', templateType)
    .single();
    
  if (error || !data) {
    console.error(`Template '${templateType}' not found:`, error);
    throw new Error(`Template '${templateType}' não encontrado no banco de dados`);
  }
  
  console.log(`✅ Template '${templateType}' loaded successfully`);
  return data as EmailTemplate;
}

export function validateTemplateVariables(
  html: string,
  providedVariables: Record<string, string | number | undefined>
): { isValid: boolean; missingVars: string[]; unusedVars: string[] } {
  
  // Extract all placeholders from HTML
  const placeholderRegex = /\{\{([^}]+)\}\}/g;
  const placeholders = [...html.matchAll(placeholderRegex)]
    .map(match => match[1].trim());
  
  const uniquePlaceholders = [...new Set(placeholders)];
  const providedKeys = Object.keys(providedVariables);
  
  // Check for missing variables
  const missingVars = uniquePlaceholders.filter(
    placeholder => !providedKeys.includes(placeholder)
  );
  
  // Check for unused variables
  const unusedVars = providedKeys.filter(
    key => !uniquePlaceholders.includes(key)
  );
  
  return {
    isValid: missingVars.length === 0,
    missingVars,
    unusedVars
  };
}

export function replaceVariables(
  html: string,
  variables: Record<string, string | number | undefined>
): string {
  let result = html;
  
  for (const [key, value] of Object.entries(variables)) {
    // Converter valor para string (tratar null/undefined)
    const stringValue = value !== null && value !== undefined ? String(value) : '';
    
    // Escapar caracteres especiais na chave para regex
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\{\\{${escapedKey}\\}\\}`, 'g');
    const replaced = result.replace(regex, stringValue);
    
    // Verificar se a substituição aconteceu
    if (replaced === result && result.includes(`{{${key}}}`)) {
      console.warn(`⚠️ Variável {{${key}}} não foi substituída (valor: ${stringValue || 'vazio'})`);
    }
    
    result = replaced;
  }
  
  console.log(`✅ Variables replaced:`, Object.keys(variables));
  
  // Verificar se ainda há variáveis não substituídas
  const remainingVars = result.match(/\{\{([^}]+)\}\}/g);
  if (remainingVars && remainingVars.length > 0) {
    console.warn(`⚠️ Variáveis não substituídas restantes:`, remainingVars);
  }
  
  return result;
}

export async function logEmail(
  supabaseClient: SupabaseClient,
  emailData: {
    email_type: string;
    recipient_email: string;
    resend_email_id?: string;
    order_id?: string;
    song_id?: string;
    template_used: string;
    status: 'sent' | 'failed';
    metadata?: any;
  }
) {
  try {
    const { error } = await supabaseClient
      .from('email_logs')
      .insert({
        email_type: emailData.email_type,
        recipient_email: emailData.recipient_email,
        resend_email_id: emailData.resend_email_id,
        order_id: emailData.order_id,
        song_id: emailData.song_id,
        template_used: emailData.template_used,
        status: emailData.status,
        metadata: emailData.metadata || {},
        sent_at: new Date().toISOString()
      });
      
    if (error) {
      console.error('❌ Failed to log email:', error);
    } else {
      console.log(`✅ Email logged successfully: ${emailData.email_type} to ${emailData.recipient_email}`);
    }
  } catch (err) {
    console.error('❌ Exception while logging email:', err);
  }
}

/**
 * Função centralizada para envio de emails via Resend
 * Integra validação, rate limiting, headers e logging
 * 
 * @param supabase - Cliente Supabase
 * @param options - Opções de envio
 * @returns Resultado do envio
 */
export async function sendEmail(
  supabase: SupabaseClient,
  options: SendEmailOptions
): Promise<{
  success: boolean;
  emailId?: string;
  error?: string;
  reason?: string;
}> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  
  if (!resendApiKey) {
    return {
      success: false,
      error: "RESEND_API_KEY não configurada"
    };
  }

  // Normalizar email
  const normalizedEmail = normalizeEmail(options.to);
  
  if (!normalizedEmail) {
    return {
      success: false,
      error: "Email inválido",
      reason: "Email não fornecido ou formato inválido"
    };
  }

  // 1. Validar email (se não pular validação)
  if (!options.skipValidation) {
    const validation = await validateEmailForSending(supabase, normalizedEmail);
    
    if (!validation.canSend) {
      console.warn(`⚠️ [SendEmail] Email não pode ser enviado: ${validation.reason}`);
      return {
        success: false,
        error: "Email não pode ser enviado",
        reason: validation.reason
      };
    }
  }

  // 2. Verificar rate limits (se não pular)
  // Para emails transacionais importantes (music_released, order_paid), usar configuração mais permissiva
  if (!options.skipRateLimit) {
    // Configuração mais permissiva para emails transacionais importantes
    const transactionalConfig = options.rateLimitConfig || {
      perRecipient: {
        maxEmails: 5, // Permite múltiplos emails transacionais (order_paid, music_released, etc)
        windowMinutes: 60,
      },
      global: {
        maxEmails: 500,
        windowMinutes: 60,
      },
      delayBetweenSends: 50, // Delay menor para emails transacionais
    };

    const rateLimitCheck = await checkAllRateLimits(
      supabase,
      normalizedEmail,
      transactionalConfig
    );

    if (!rateLimitCheck.allowed) {
      console.warn(`⚠️ [SendEmail] Rate limit excedido: ${rateLimitCheck.reason}`);
      // Para emails transacionais críticos (order_paid, music_released), logar mas não bloquear completamente
      // Apenas avisar, mas permitir envio - esses emails são críticos e devem ser enviados sempre
      const isTransactionalCritical = options.templateType === 'music_released' || options.templateType === 'order_paid';
      if (isTransactionalCritical) {
        console.warn(`⚠️ [SendEmail] Rate limit excedido para ${options.templateType}, mas permitindo envio (email transacional crítico)`);
      } else {
        return {
          success: false,
          error: "Rate limit excedido",
          reason: rateLimitCheck.reason
        };
      }
    }

    // Aplicar delay entre envios
    await applySendDelay(transactionalConfig);
  }

  // 3. Melhorar conteúdo do email (remover emojis, adicionar alt text, etc.)
  const improvedContent = improveEmailContent({
    subject: options.subject,
    html: options.html,
    addPhysicalAddress: true, // Adicionar endereço físico para CAN-SPAM compliance
  });

  // 4. Preparar remetente (sempre usar domínio verificado)
  const appName = Deno.env.get('APP_NAME') || 'Sua Música Fácil';
  const envFrom = Deno.env.get('RESEND_FROM_EMAIL') || Deno.env.get('EMAIL_FROM');
  const defaultEmail = 'contato@suamusicafacil.com';

  // ✅ Priorizar domínio verificado
  let fromHeader = options.from || (envFrom ? `${appName} <${envFrom}>` : undefined) || `${appName} <${defaultEmail}>`;
  
  // ✅ Garantir que não use onboarding@resend.dev em produção
  if (fromHeader.includes('onboarding@resend.dev')) {
    console.warn('⚠️ [SendEmail] Usando onboarding@resend.dev - considere verificar domínio');
    fromHeader = `${appName} <${defaultEmail}>`;
  }
  
  if (!fromHeader.includes('<')) {
    // Se não tem formato "Name <email>", adicionar
    fromHeader = `${appName} <${fromHeader}>`;
  }

  // 5. Gerar headers
  const baseUrl = options.baseUrl || Deno.env.get('SITE_URL') || 'https://suamusicafacil.com';
  // Emails transacionais: order_paid, music_released, etc. (não marketing)
  const isTransactional = options.templateType ? 
    ['order_paid', 'music_released', 'payment_confirmed', 'production_started', 'production_complete', 'lyrics_approval'].includes(options.templateType) :
    true; // Por padrão, assumir transacional
  // Permitir avatar por padrão (Gravatar será usado se configurado)
  const enableAvatar = options.enableAvatar !== false; // Padrão: true
  const headers = getEmailHeaders(normalizedEmail, undefined, baseUrl, isTransactional, enableAvatar);

  // 6. Gerar versão texto do email (obrigatório para melhor deliverability, especialmente Outlook)
  // Outlook e outros clientes penalizam emails sem versão texto
  const textVersion = options.text || htmlToText(improvedContent.html);
  
  // 7. Preparar payload do Resend
  const payload: any = {
    from: fromHeader,
    to: [normalizedEmail],
    subject: improvedContent.subject, // Usar assunto melhorado (sem emojis)
    html: improvedContent.html, // Usar HTML melhorado
    text: textVersion, // ✅ SEMPRE incluir versão texto para melhor deliverability
    reply_to: options.replyTo || undefined, // Usar reply-to fornecido ou deixar undefined (Resend usa from por padrão)
    tags: options.tags || [],
  };

  // ✅ Remover reply_to se for undefined (Resend não aceita undefined explicitamente)
  if (!payload.reply_to) {
    delete payload.reply_to;
  }

  // Adicionar headers
  addHeadersToResendPayload(payload, headers);

  // 7. Enviar via Resend
  try {
    console.log(`📧 [SendEmail] Enviando email para: ${normalizedEmail}`);
    
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!resendResponse.ok) {
      const errorData = await resendResponse.json().catch(() => ({ message: 'Unknown error' }));
      console.error('❌ [SendEmail] Resend API error:', errorData);
      
      // Log do erro
      await logEmail(supabase, {
        email_type: options.templateType || 'unknown',
        recipient_email: normalizedEmail,
        order_id: options.orderId,
        song_id: options.songId,
        template_used: options.templateType || 'unknown',
        status: 'failed',
        metadata: {
          error: errorData.message || 'Unknown error',
          subject: options.subject,
          language: options.language,
          variables: options.variables,
        }
      });

      return {
        success: false,
        error: `Resend API error: ${errorData.message || 'Unknown error'}`
      };
    }

    const resendData = await resendResponse.json();
    const emailId = resendData.id;

    console.log(`✅ [SendEmail] Email enviado com sucesso: ${emailId}`);

    // 8. Log do sucesso
    try {
      await supabase.rpc('log_email_send', {
        p_template_type: options.templateType || 'unknown',
        p_language: options.language || 'pt',
        p_recipient_email: normalizedEmail,
        p_subject: options.subject,
        p_status: 'sent',
        p_resend_id: emailId,
        p_order_id: options.orderId || null,
        p_song_id: options.songId || null,
        p_variables: options.variables || null
      });
    } catch (logError) {
      console.warn('⚠️ [SendEmail] Erro ao logar email (não bloqueante):', logError);
    }

    return {
      success: true,
      emailId: emailId
    };

  } catch (error) {
    console.error('❌ [SendEmail] Erro inesperado:', error);
    
    // Log do erro
    await logEmail(supabase, {
      email_type: options.templateType || 'unknown',
      recipient_email: normalizedEmail,
      order_id: options.orderId,
      song_id: options.songId,
      template_used: options.templateType || 'unknown',
      status: 'failed',
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        subject: options.subject,
      }
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Converte HTML para texto simples (versão básica)
 * Remove tags HTML e preserva conteúdo
 * 
 * @param html - HTML a converter
 * @returns Texto simples
 */
export function htmlToText(html: string): string {
  // Remover scripts e styles
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  
  // Converter quebras de linha
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<\/h[1-6]>/gi, '\n\n');
  
  // Remover tags HTML
  text = text.replace(/<[^>]+>/g, '');
  
  // Decodificar entidades HTML
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  
  // Limpar espaços em branco excessivos
  text = text.replace(/\n\s*\n\s*\n/g, '\n\n');
  text = text.replace(/[ \t]+/g, ' ');
  text = text.trim();
  
  return text;
}
