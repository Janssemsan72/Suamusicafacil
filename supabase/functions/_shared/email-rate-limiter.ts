/**
 * Email Rate Limiter Utility
 * 
 * Implementa rate limiting para envio de emails:
 * - Limita envios por destinatário (ex: 1 email por hora para transacionais)
 * - Limita envios globais por minuto/hora
 * - Implementa fila com delays entre envios
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

export interface RateLimitConfig {
  // Limite por destinatário
  perRecipient?: {
    maxEmails: number;
    windowMinutes: number;
  };
  // Limite global
  global?: {
    maxEmails: number;
    windowMinutes: number;
  };
  // Delay entre envios (em milissegundos)
  delayBetweenSends?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  retryAfter?: number; // Segundos até poder enviar novamente
}

const DEFAULT_CONFIG: RateLimitConfig = {
  perRecipient: {
    maxEmails: 3, // Máximo 3 emails por destinatário por hora (permite order_paid + music_released + retry)
    windowMinutes: 60, // Por hora
  },
  global: {
    maxEmails: 500, // Máximo 500 emails globais por hora
    windowMinutes: 60, // Por hora
  },
  delayBetweenSends: 100, // 100ms entre envios
};

/**
 * Verifica se pode enviar email para destinatário específico
 * 
 * @param supabase - Cliente Supabase
 * @param recipientEmail - Email do destinatário
 * @param config - Configuração de rate limit
 * @returns Resultado da verificação
 */
export async function checkRecipientRateLimit(
  supabase: SupabaseClient,
  recipientEmail: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): Promise<RateLimitResult> {
  if (!config.perRecipient) {
    return { allowed: true };
  }

  try {
    const { maxEmails, windowMinutes } = config.perRecipient;
    const windowStart = new Date();
    windowStart.setMinutes(windowStart.getMinutes() - windowMinutes);

    // Contar emails enviados para este destinatário na janela de tempo
    const { data, error, count } = await supabase
      .from('email_logs')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_email', recipientEmail.toLowerCase().trim())
      .eq('status', 'sent')
      .gte('sent_at', windowStart.toISOString());

    if (error) {
      console.error('❌ [RateLimiter] Erro ao verificar rate limit:', error);
      // Em caso de erro, permitir envio (fail open)
      return { allowed: true };
    }

    const emailCount = count || 0;

    if (emailCount >= maxEmails) {
      // Calcular quando poderá enviar novamente
      // Buscar o email mais antigo na janela
      const { data: oldestEmail } = await supabase
        .from('email_logs')
        .select('sent_at')
        .eq('recipient_email', recipientEmail.toLowerCase().trim())
        .eq('status', 'sent')
        .gte('sent_at', windowStart.toISOString())
        .order('sent_at', { ascending: true })
        .limit(1)
        .single();

      let retryAfter: number | undefined;
      if (oldestEmail?.sent_at) {
        const oldestDate = new Date(oldestEmail.sent_at);
        const retryDate = new Date(oldestDate);
        retryDate.setMinutes(retryDate.getMinutes() + windowMinutes);
        retryAfter = Math.max(0, Math.ceil((retryDate.getTime() - Date.now()) / 1000));
      }

      return {
        allowed: false,
        reason: `Rate limit excedido: máximo ${maxEmails} email(s) por ${windowMinutes} minutos para este destinatário`,
        retryAfter
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error('❌ [RateLimiter] Exceção ao verificar rate limit:', error);
    return { allowed: true };
  }
}

/**
 * Verifica rate limit global
 * 
 * @param supabase - Cliente Supabase
 * @param config - Configuração de rate limit
 * @returns Resultado da verificação
 */
export async function checkGlobalRateLimit(
  supabase: SupabaseClient,
  config: RateLimitConfig = DEFAULT_CONFIG
): Promise<RateLimitResult> {
  if (!config.global) {
    return { allowed: true };
  }

  try {
    const { maxEmails, windowMinutes } = config.global;
    const windowStart = new Date();
    windowStart.setMinutes(windowStart.getMinutes() - windowMinutes);

    // Contar emails enviados globalmente na janela de tempo
    const { count, error } = await supabase
      .from('email_logs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'sent')
      .gte('sent_at', windowStart.toISOString());

    if (error) {
      console.error('❌ [RateLimiter] Erro ao verificar rate limit global:', error);
      return { allowed: true };
    }

    const emailCount = count || 0;

    if (emailCount >= maxEmails) {
      return {
        allowed: false,
        reason: `Rate limit global excedido: máximo ${maxEmails} email(s) por ${windowMinutes} minutos`,
        retryAfter: windowMinutes * 60 // Retry após a janela completa
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error('❌ [RateLimiter] Exceção ao verificar rate limit global:', error);
    return { allowed: true };
  }
}

/**
 * Verifica todos os rate limits
 * 
 * @param supabase - Cliente Supabase
 * @param recipientEmail - Email do destinatário
 * @param config - Configuração de rate limit
 * @returns Resultado da verificação
 */
export async function checkAllRateLimits(
  supabase: SupabaseClient,
  recipientEmail: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): Promise<RateLimitResult> {
  // Verificar rate limit por destinatário
  const recipientCheck = await checkRecipientRateLimit(supabase, recipientEmail, config);
  if (!recipientCheck.allowed) {
    return recipientCheck;
  }

  // Verificar rate limit global
  const globalCheck = await checkGlobalRateLimit(supabase, config);
  if (!globalCheck.allowed) {
    return globalCheck;
  }

  return { allowed: true };
}

/**
 * Aplica delay entre envios (se configurado)
 * 
 * @param config - Configuração de rate limit
 * @returns Promise que resolve após o delay
 */
export async function applySendDelay(
  config: RateLimitConfig = DEFAULT_CONFIG
): Promise<void> {
  const delay = config.delayBetweenSends || DEFAULT_CONFIG.delayBetweenSends || 0;
  if (delay > 0) {
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

/**
 * Cria configuração customizada de rate limit
 * 
 * @param options - Opções de configuração
 * @returns Configuração de rate limit
 */
export function createRateLimitConfig(
  options: Partial<RateLimitConfig>
): RateLimitConfig {
  return {
    ...DEFAULT_CONFIG,
    ...options,
    perRecipient: options.perRecipient 
      ? { ...DEFAULT_CONFIG.perRecipient, ...options.perRecipient }
      : DEFAULT_CONFIG.perRecipient,
    global: options.global
      ? { ...DEFAULT_CONFIG.global, ...options.global }
      : DEFAULT_CONFIG.global,
  };
}

