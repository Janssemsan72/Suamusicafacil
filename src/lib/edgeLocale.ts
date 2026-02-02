/**
 * Detecção de idioma via Edge Function da Supabase (gratuito e rápido no edge)
 * Estratégia: construir a URL de functions a partir do SUPABASE_URL
 * - SUPABASE_URL: https://<ref>.supabase.co
 * - FUNCTIONS_URL: https://<ref>.functions.supabase.co
 */

// ✅ CORREÇÃO CRÍTICA: Import estático para evitar loops de HMR
import { supabase } from '@/integrations/supabase/client';

export type EdgeLocaleResponse = {
  language: 'pt';
  country: string | null;
  ip?: string | null;
  source?: string;
  error?: string;
};

function buildFunctionsBaseUrl(): string | null {
  // Vite env
  const supabaseUrl = (import.meta as any)?.env?.VITE_SUPABASE_URL as string | undefined;
  const fallback = 'https://pszyhjshppvrzhkrgmrz.supabase.co';
  const final = supabaseUrl || fallback;

  try {
    const u = new URL(final);
    // <ref>.supabase.co -> <ref>.functions.supabase.co
    const host = u.host.replace('.supabase.co', '.functions.supabase.co');
    return `${u.protocol}//${host}`;
  } catch {
    return null;
  }
}

// ✅ CORREÇÃO LOADING INFINITO: Função helper para verificar se cliente Supabase é válido (não dummy)
function isSupabaseClientValid(): boolean {
  try {
    // Verificar se supabase existe e tem functions
    if (!supabase || !supabase.functions) {
      return false;
    }
    
    // Verificar se é dummy client (dummy client retorna erro específico)
    // Se o cliente for dummy, a função invoke retornará erro com mensagem específica
    // Mas não podemos chamar invoke aqui, então verificamos se tem a estrutura correta
    const hasValidStructure = 
      typeof supabase.functions.invoke === 'function' &&
      supabase.functions.invoke.length >= 1;
    
    return hasValidStructure;
  } catch {
    return false;
  }
}

export async function detectLocaleAtEdge(signal?: AbortSignal): Promise<EdgeLocaleResponse | null> {
  // ✅ CORREÇÃO LOADING INFINITO: Verificar se já foi abortado antes de começar
  if (signal?.aborted) {
    return null;
  }
  
  // ✅ CORREÇÃO LOADING INFINITO: Verificar se cliente Supabase é válido antes de tentar chamar
  const isClientValid = isSupabaseClientValid();
  if (!isClientValid) {
    console.error('[edgeLocale] Cliente Supabase não é válido (pode ser dummy). Pulando detecção via Edge Function.');
    // Continuar para tentar outros métodos (URL direta ou fallback)
  }
  
  // ✅ CORREÇÃO LOADING INFINITO: Timeout total máximo de 2 segundos
  const MAX_TOTAL_TIMEOUT = 2000;
  const startTime = Date.now();
  
  // 1) Tentar via SDK do Supabase (se disponível), com timeout curto
  if (isClientValid) {
    try {
      // ✅ CORREÇÃO LOADING INFINITO: Timeout reduzido para 800ms (dentro do limite de 2s)
      if (Date.now() - startTime > MAX_TOTAL_TIMEOUT - 800) {
        console.error('[edgeLocale] Timeout total próximo, pulando detecção via SDK');
        return null;
      }
      
      if (supabase?.functions && !signal?.aborted) {
        const controller = new AbortController();
        const timeout = setTimeout(() => {
          controller.abort();
          console.error('[edgeLocale] Timeout na chamada SDK (800ms)');
        }, 800);
        
        // ✅ OTIMIZAÇÃO MOBILE: Combinar signals
        if (signal) {
          signal.addEventListener('abort', () => {
            controller.abort();
            clearTimeout(timeout);
          });
        }
        
        try {
          const { data, error } = await supabase.functions.invoke('detect-country-by-ip', {
            signal: controller.signal,
          });
          clearTimeout(timeout);
          
          if (!error && data && (data.language || data.country) && !signal?.aborted) {
            return {
              language: normalizeSimpleLocale(data.language) || 'pt',
              country: data.country || null,
              ip: data.ip || null,
              source: data.source || 'sdk',
            };
          }
          
          if (error) {
            console.error('[edgeLocale] Erro na chamada SDK:', error.message || error);
          }
        } catch (invokeError: any) {
          clearTimeout(timeout);
          // ✅ CORREÇÃO LOADING INFINITO: Verificar se é erro de dummy client
          if (invokeError?.message?.includes('dummy client') || invokeError?.message?.includes('CLIENT_NOT_INITIALIZED')) {
            console.error('[edgeLocale] Cliente dummy detectado, pulando SDK');
          } else if (!signal?.aborted) {
            console.error('[edgeLocale] Erro ao chamar Edge Function via SDK:', invokeError?.message || invokeError);
          }
        }
      }
    } catch (e) {
      // silenciar, tentar próximo método
      if (signal?.aborted) return null;
    }
  }

  // ✅ CORREÇÃO LOADING INFINITO: Verificar se foi abortado e timeout total
  if (signal?.aborted) {
    return null;
  }
  
  if (Date.now() - startTime > MAX_TOTAL_TIMEOUT) {
    console.error('[edgeLocale] Timeout total de 2s atingido, retornando null');
    return null;
  }
  
  // 2) Tentar URL direta das Functions
  try {
    const base = buildFunctionsBaseUrl();
    if (base && !signal?.aborted) {
      // ✅ CORREÇÃO LOADING INFINITO: Timeout reduzido para 600ms (dentro do limite de 2s)
      const remainingTime = MAX_TOTAL_TIMEOUT - (Date.now() - startTime);
      if (remainingTime < 600) {
        console.error('[edgeLocale] Tempo restante insuficiente para URL direta, pulando');
        return null;
      }
      
      const url = `${base}/detect-country-by-ip`;
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
        console.error('[edgeLocale] Timeout na chamada URL direta (600ms)');
      }, Math.min(600, remainingTime));
      
      // ✅ OTIMIZAÇÃO MOBILE: Combinar signals
      if (signal) {
        signal.addEventListener('abort', () => {
          controller.abort();
          clearTimeout(timeout);
        });
      }
      
      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: controller.signal,
          credentials: 'omit',
          cache: 'no-store',
        });
        clearTimeout(timeout);
        if (res.ok && !signal?.aborted) {
          const data = (await res.json()) as EdgeLocaleResponse;
          if (data && (data.language || data.country)) {
            return data;
          }
        }
      } catch (fetchError: any) {
        clearTimeout(timeout);
        if (!signal?.aborted) {
          console.error('[edgeLocale] Erro ao chamar URL direta:', fetchError?.message || fetchError);
        }
      }
    }
  } catch (e) {
    // seguir para fallback
    if (signal?.aborted) return null;
  }

  // ✅ CORREÇÃO LOADING INFINITO: Verificar se foi abortado e timeout total
  if (signal?.aborted) {
    return null;
  }
  
  if (Date.now() - startTime > MAX_TOTAL_TIMEOUT) {
    console.error('[edgeLocale] Timeout total de 2s atingido antes do fallback, retornando null');
    return null;
  }
  
  // 3) Fallback público rápido como último recurso (curto timeout)
  try {
    // ✅ CORREÇÃO LOADING INFINITO: Timeout reduzido para 500ms (dentro do limite de 2s)
    const remainingTime = MAX_TOTAL_TIMEOUT - (Date.now() - startTime);
    if (remainingTime < 500) {
      console.error('[edgeLocale] Tempo restante insuficiente para fallback, retornando null');
      return null;
    }
    
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
      console.error('[edgeLocale] Timeout no fallback ipapi (500ms)');
    }, Math.min(500, remainingTime));
    
    // ✅ OTIMIZAÇÃO MOBILE: Combinar signals
    if (signal) {
      signal.addEventListener('abort', () => {
        controller.abort();
        clearTimeout(timeout);
      });
    }
    
    try {
      const res = await fetch('https://ipapi.co/json/', {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
        credentials: 'omit',
        cache: 'no-store',
      });
      clearTimeout(timeout);
      if (res.ok && !signal?.aborted) {
        const data = await res.json();
        const country = (data?.country_code as string) || null;
        const lang = countryToLang(country);
        return { language: lang, country, ip: data?.ip || null, source: 'ipapi' };
      }
    } catch (fetchError: any) {
      clearTimeout(timeout);
      if (!signal?.aborted) {
        console.error('[edgeLocale] Erro no fallback ipapi:', fetchError?.message || fetchError);
      }
    }
  } catch {
    // ignorar
    if (signal?.aborted) return null;
  }

  // ✅ CORREÇÃO LOADING INFINITO: Sempre retornar null se chegou aqui (não travar)
  console.error('[edgeLocale] Todas as tentativas de detecção falharam, retornando null');
  return null;
}

export function normalizeSimpleLocale(lang?: string | null): 'pt' | null {
  if (!lang) return null;
  const b = lang.slice(0, 2).toLowerCase();
  if (b === 'pt') return b;
  return null;
}

function countryToLang(_country?: string | null): 'pt' {
  return 'pt';
}


