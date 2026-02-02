/**
 * Rate Limiting para Edge Functions
 * Usa função SQL existente no Supabase
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

export interface RateLimitConfig {
  maxRequests: number;
  windowMinutes: number;
  identifier: string; // IP, user_id, order_id, etc
  action: string; // Nome da ação (ex: 'checkout', 'generate-lyrics')
}

export interface RateLimitResult {
  allowed: boolean;
  remaining?: number;
  retryAfter?: number;
}

/**
 * Verifica rate limit usando função SQL existente
 */
export async function checkRateLimit(
  supabaseClient: SupabaseClient,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const { maxRequests, windowMinutes, identifier, action } = config;

  try {
    // Usar função SQL existente
    const { data, error } = await supabaseClient.rpc('check_rate_limit', {
      _identifier: identifier,
      _action: action,
      _max_count: maxRequests,
      _window_minutes: windowMinutes,
    });

    if (error) {
      // Em caso de erro, permitir requisição (fail open)
      console.warn('⚠️ [RateLimit] Erro ao verificar rate limit:', error);
      return { allowed: true };
    }

    const allowed = data === true;

    if (!allowed) {
      // Calcular retry after (aproximado)
      const retryAfter = windowMinutes * 60; // segundos
      return {
        allowed: false,
        retryAfter,
      };
    }

    return {
      allowed: true,
    };
  } catch (error) {
    // Em caso de erro, permitir requisição (fail open)
    console.error('❌ [RateLimit] Erro inesperado:', error);
    return { allowed: true };
  }
}

/**
 * Limpa registros de rate limit antigos usando função SQL
 */
export async function cleanupRateLimits(supabaseClient: SupabaseClient): Promise<void> {
  try {
    const { error } = await supabaseClient.rpc('cleanup_old_rate_limits');

    if (error) {
      console.warn('⚠️ [RateLimit] Erro ao limpar rate limits antigos:', error);
    }
  } catch (error) {
    console.error('❌ [RateLimit] Erro ao limpar rate limits:', error);
  }
}

