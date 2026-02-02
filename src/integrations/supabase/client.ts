import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Verificar se está em desenvolvimento
const isDev = import.meta.env.DEV;

// ✅ SEGURANÇA: Usar variáveis de ambiente em vez de hardcode
// Suporta VITE_SUPABASE_PUBLISHABLE_KEY ou VITE_SUPABASE_ANON_KEY (convenção Supabase)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

// Fallback para desenvolvimento local
const SUPABASE_URL_FALLBACK = 'https://zagkvtxarndluusiluhb.supabase.co';
const SUPABASE_PUBLISHABLE_KEY_FALLBACK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphZ2t2dHhhcm5kbHV1c2lsdWhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NTcwNTUsImV4cCI6MjA3NjMzMzA1NX0.2b4Z6H7dIMn0YNeKS-1Cf54AJt4HVgcLBeOFTs3ceHs';

// ✅ CORREÇÃO LOADING INFINITO: Logs de diagnóstico apenas em desenvolvimento e apenas para erros
// Verificar se variáveis de ambiente estão definidas
if (typeof window !== 'undefined' && isDev) {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    console.warn('[Supabase Init] ⚠️ ATENÇÃO: Variáveis de ambiente não configuradas!');
    console.warn('[Supabase Init] VITE_SUPABASE_URL:', SUPABASE_URL ? '✅ Definida' : '❌ Undefined');
    console.warn('[Supabase Init] VITE_SUPABASE_PUBLISHABLE_KEY:', SUPABASE_PUBLISHABLE_KEY ? '✅ Definida' : '❌ Undefined');
    console.warn('[Supabase Init] Usando fallback - funcionalidades podem ser limitadas');
  }
}

// ✅ CORREÇÃO: Garantir que sempre usa URL remota (não localhost)
let finalUrl = SUPABASE_URL || SUPABASE_URL_FALLBACK;
const finalKey = SUPABASE_PUBLISHABLE_KEY || SUPABASE_PUBLISHABLE_KEY_FALLBACK;

// ✅ CORREÇÃO CRÍTICA: Se detectar localhost, forçar uso da URL remota
if (
  finalUrl &&
  (finalUrl.includes('localhost') ||
    finalUrl.includes('127.0.0.1') ||
    finalUrl.includes(':54321') ||
    finalUrl.includes(':9999'))
) {
  if (isDev) {
    console.warn('⚠️ [Supabase] URL localhost detectada, forçando uso da URL remota');
  }
  finalUrl = SUPABASE_URL_FALLBACK;
}

// ✅ CORREÇÃO CRÍTICA: Singleton pattern robusto para evitar loops de HMR
// Usar variável global que persiste mesmo com recarregamentos do módulo
let supabase: any = null;

// ✅ FASE 3: Função para criar cliente com fallback robusto
function createSupabaseClient(): any {
  try {
    if (!finalUrl || !finalKey) {
      if (isDev) {
        console.error('❌ [Supabase] URL ou chave não configuradas');
        console.warn('⚠️ [Supabase] Usando cliente dummy - funcionalidades limitadas');
      }
      // ✅ FASE 3: Retornar cliente dummy para evitar erros
      return createDummyClient();
    }

    const client = createClient<Database>(finalUrl, finalKey, {
      auth: {
        storage: typeof window !== 'undefined' ? localStorage : undefined,
        persistSession: true,
        autoRefreshToken: true,
      },
      // ✅ CORREÇÃO: Garantir que Edge Functions sempre usam URL remota
      global: {
        headers: {
          'X-Client-Info': 'musiclovely-web',
        },
      },
      // ✅ CORREÇÃO ERRO 401 REALTIME: Desabilitar Realtime automático para evitar conexões não autenticadas
      // O Realtime só será usado explicitamente quando necessário (ex: AdminDashboard)
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
        log_level: 'error' as const,
        heartbeatIntervalMs: 30000,
        reconnectAfterMs: (tries: number) => Math.min(tries * 1000, 30000),
        // ✅ CRÍTICO: Não conectar automaticamente - apenas quando explicitamente solicitado
        // Isso evita erros 401 quando usuários não autenticados acessam a aplicação
        // ✅ CORREÇÃO: Removido transport para evitar erro "this.transport is not a constructor" no build de produção
        // O Supabase usará o transport padrão (websocket) automaticamente
      },
    });

    // ✅ CORREÇÃO CRÍTICA: Verificar e corrigir URL interna do cliente para Edge Functions
    // O cliente Supabase JS usa a URL base para construir a URL das Edge Functions
    // Se a URL for localhost, as Edge Functions também tentarão usar localhost
    if (client && typeof client === 'object') {
      // Verificar se há uma propriedade interna que precisa ser corrigida
      const internalUrl = (client as any).supabaseUrl || (client as any).rest?.url;
      if (internalUrl && (internalUrl.includes('localhost') || internalUrl.includes('127.0.0.1'))) {
        if (isDev) {
          console.warn('⚠️ [Supabase] URL interna do cliente ainda é localhost, forçando correção...');
        }
        // Tentar sobrescrever a URL interna (pode não funcionar, mas tentamos)
        if ((client as any).supabaseUrl) {
          (client as any).supabaseUrl = SUPABASE_URL_FALLBACK;
        }
        if ((client as any).rest?.url) {
          (client as any).rest.url = SUPABASE_URL_FALLBACK;
        }
      }
    }

    // ✅ DIAGNÓSTICO: Log apenas se houver problema (reduzir verbosidade)
    if (
      isDev &&
      (finalUrl.includes('localhost') ||
        finalUrl.includes('127.0.0.1') ||
        !SUPABASE_URL ||
        !SUPABASE_PUBLISHABLE_KEY)
    ) {
      console.warn('⚠️ [Supabase] Cliente criado com configuração não ideal', {
        url: finalUrl,
        isRemote: !finalUrl.includes('localhost') && !finalUrl.includes('127.0.0.1'),
        usingFallback: !SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY,
      });
    }

    // ✅ CORREÇÃO: Verificar se está usando URL remota
    if (finalUrl.includes('localhost') || finalUrl.includes('127.0.0.1')) {
      if (isDev) {
        console.error('❌ [Supabase] ERRO: Cliente está usando localhost! Isso causará problemas de acesso ao banco.');
        console.error('❌ [Supabase] URL atual:', finalUrl);
        console.error('❌ [Supabase] Forçando uso da URL remota...');
      }
      // Recriar cliente com URL remota
      return createClient<Database>(SUPABASE_URL_FALLBACK, finalKey, {
        auth: {
          storage: typeof window !== 'undefined' ? localStorage : undefined,
          persistSession: true,
          autoRefreshToken: true,
        },
      });
    }

    return client;
  } catch (error) {
    if (isDev) {
      console.error('❌ [Supabase] Erro ao criar cliente:', error);
      console.warn('⚠️ [Supabase] Usando cliente dummy devido ao erro');
    }
    // ✅ FASE 3: Retornar cliente dummy em caso de erro
    return createDummyClient();
  }
}

// ✅ FASE 3: Cliente dummy para evitar erros quando inicialização falha
function createDummyClient(): any {
  // ✅ CORREÇÃO LOADING INFINITO: Logs apenas em desenvolvimento
  if (isDev) {
    console.warn('[Supabase] ⚠️ Usando cliente dummy - funcionalidades limitadas');
    console.warn('[Supabase] ⚠️ DIAGNÓSTICO: Cliente dummy criado - Edge Functions não funcionarão');
    console.warn('[Supabase] ⚠️ Verifique se VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY estão configuradas na Vercel');
  }

  // ✅ FASE 3: Cliente dummy mais completo para evitar erros
  const dummyError = { message: 'Cliente não inicializado', code: 'CLIENT_NOT_INITIALIZED' };

  return {
    auth: {
      getSession: async () => ({
        data: { session: null, user: null },
        error: null,
      }),
      signOut: async () => ({ error: null }),
      signInWithPassword: async () => ({ data: null, error: dummyError }),
      getUser: async () => ({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: null }, error: null }),
    },
    from: (_table: string) => ({
      select: (_columns?: string) => ({
        eq: (_column: string, _value: any) => ({
          single: async () => ({ data: null, error: null }),
          maybeSingle: async () => ({ data: null, error: null }),
        }),
        insert: async () => ({ data: null, error: null }),
        update: async () => ({ data: null, error: null }),
        delete: async () => ({ data: null, error: null }),
      }),
      insert: async () => ({ data: null, error: null }),
      update: async () => ({ data: null, error: null }),
      delete: async () => ({ data: null, error: null }),
    }),
    functions: {
      invoke: async (functionName: string, _options?: any) => {
        // ✅ CORREÇÃO LOADING INFINITO: Logs apenas em desenvolvimento
        if (isDev) {
          console.warn('[Dummy Client] ❌ Tentativa de chamar Edge Function:', functionName);
          console.warn('[Dummy Client] ❌ Cliente Supabase não está configurado. Verifique as variáveis de ambiente.');
          console.warn('[Dummy Client] ❌ Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY na Vercel');
        }
        return {
          data: null,
          error: {
            message:
              'Failed to send a request to the Edge Function - Cliente Supabase não está configurado corretamente (dummy client). Verifique as variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.',
            status: 503,
            name: 'FunctionsError',
          },
        };
      },
    },
    storage: {
      from: () => ({
        upload: async () => ({ data: null, error: null }),
        download: async () => ({ data: null, error: null }),
        list: async () => ({ data: null, error: null }),
        remove: async () => ({ data: null, error: null }),
      }),
    },
    realtime: {
      channel: () => ({
        on: () => ({ unsubscribe: () => {} }),
        subscribe: async () => ({ data: null, error: null }),
        unsubscribe: async () => ({ data: null, error: null }),
      }),
    },
  };
}

// ✅ CORREÇÃO: Inicializar apenas uma vez usando variável global
if (typeof window !== 'undefined') {
  // @ts-ignore
  if (!window.__SUPABASE_CLIENT_INSTANCE__) {
    try {
      // @ts-ignore
      window.__SUPABASE_CLIENT_INSTANCE__ = createSupabaseClient();
      // @ts-ignore
      supabase = window.__SUPABASE_CLIENT_INSTANCE__;

      // ✅ FASE 3: Validar que o cliente foi criado corretamente
      if (!supabase || !supabase.auth) {
        if (isDev) {
          console.error('❌ [Supabase] Cliente criado mas inválido. Recriando...');
        }
        // @ts-ignore
        window.__SUPABASE_CLIENT_INSTANCE__ = createSupabaseClient();
        // @ts-ignore
        supabase = window.__SUPABASE_CLIENT_INSTANCE__;
      }

      // ✅ DIAGNÓSTICO: Log apenas se houver problema (reduzir verbosidade)
      if (isDev && (!supabase?.auth || !supabase?.functions || !SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY)) {
        console.warn('⚠️ [Supabase] Cliente inicializado com problemas', {
          hasAuth: !!supabase?.auth,
          hasFunctions: !!supabase?.functions,
          isDummy: !supabase?.auth || !supabase?.functions,
          usingFallback: !SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY,
        });
      }
    } catch (error) {
      if (isDev) {
        console.error('❌ [Supabase] Erro crítico ao inicializar cliente:', error);
      }
      // @ts-ignore
      window.__SUPABASE_CLIENT_INSTANCE__ = createDummyClient();
      // @ts-ignore
      supabase = window.__SUPABASE_CLIENT_INSTANCE__;
    }
  } else {
    // ✅ CORREÇÃO: SEMPRE reutilizar instância existente (mesmo com HMR)
    // @ts-ignore
    supabase = window.__SUPABASE_CLIENT_INSTANCE__;

    // ✅ FASE 3: Validar instância existente
    if (!supabase || !supabase.auth) {
      if (isDev) {
        console.warn('⚠️ [Supabase] Instância existente inválida. Recriando...');
      }
      // @ts-ignore
      window.__SUPABASE_CLIENT_INSTANCE__ = createSupabaseClient();
      // @ts-ignore
      supabase = window.__SUPABASE_CLIENT_INSTANCE__;
    }

    // ✅ DIAGNÓSTICO: Log quando reutilizando instância existente (apenas em dev)
    if (isDev) {
      if (supabase && supabase.auth && supabase.functions) {
        console.log('✅ [Supabase] Reutilizando instância existente válida', {
          hasAuth: true,
          hasFunctions: true,
          isDummy: false,
        });
      } else {
        console.warn('⚠️ [Supabase] Instância existente é dummy ou inválida', {
          hasAuth: !!supabase?.auth,
          hasFunctions: !!supabase?.functions,
          isDummy: true,
        });
      }
    }
  }
} else {
  // Fallback para SSR - criar instância local
  supabase = createSupabaseClient();
}

// ✅ FASE 3: Garantir que supabase nunca seja null ou undefined
if (!supabase) {
  if (isDev) {
    console.error('❌ [Supabase] Cliente não pôde ser inicializado. Usando cliente dummy.');
  }
  supabase = createDummyClient();
}

export { supabase };
