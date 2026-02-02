// ✅ SEGURANÇA: Rate limiting seguro para edge functions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

interface RateLimitConfig {
  identifier: string;
  action: string;
  maxCount: number;
  windowMinutes: number;
}

export const checkRateLimit = async (config: RateLimitConfig): Promise<boolean> => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { data, error } = await supabase.rpc('check_rate_limit', {
    _identifier: config.identifier,
    _action: config.action,
    _max_count: config.maxCount,
    _window_minutes: config.windowMinutes
  });

  if (error) {
    console.error('Rate limit check error:', error);
    // Em caso de erro, permitir (fail-open para não quebrar o sistema)
    return true;
  }

  return data === true;
};

export const RATE_LIMITS = {
  CHECKOUT: { maxCount: 5, windowMinutes: 60 }, // 5 tentativas por hora
  GENERATE_LYRICS: { maxCount: 10, windowMinutes: 60 }, // 10 gerações por hora
  GENERATE_LYRICS_INTERNAL: { maxCount: 10, windowMinutes: 60 }, // 10 gerações por hora
  GENERATE_AUDIO_INTERNAL: { maxCount: 10, windowMinutes: 60 }, // 10 gerações por hora
  UPLOAD: { maxCount: 20, windowMinutes: 60 }, // 20 uploads por hora
  EMAIL: { maxCount: 3, windowMinutes: 60 }, // 3 emails por hora
  ADMIN_ACTION: { maxCount: 50, windowMinutes: 60 }, // 50 ações por hora (admin)
} as const;
