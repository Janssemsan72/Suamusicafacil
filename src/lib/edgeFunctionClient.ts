/**
 * Utilitário Centralizado para Chamadas de Edge Functions
 * 
 * Fornece wrapper padronizado com:
 * - Retry automático configurável
 * - Timeout padrão
 * - Tratamento de erros consistente
 * - Logging estruturado
 * - Validação de resposta
 */

import { supabase } from '@/integrations/supabase/client';

export interface EdgeFunctionOptions {
  retries?: number;
  retryDelay?: number;
  timeout?: number;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export interface EdgeFunctionResponse<T = any> {
  data: T | null;
  error: {
    message: string;
    status?: number;
    details?: any;
  } | null;
  success: boolean;
}

const DEFAULT_OPTIONS: Required<Omit<EdgeFunctionOptions, 'headers' | 'signal'>> = {
  retries: 2,
  retryDelay: 1000,
  timeout: 30000, // 30 segundos
};

/**
 * Chama uma edge function com retry automático e tratamento de erros
 */
export async function invokeEdgeFunction<T = any>(
  functionName: string,
  body?: any,
  options: EdgeFunctionOptions = {}
): Promise<EdgeFunctionResponse<T>> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { retries, retryDelay, timeout, headers: customHeaders, signal } = opts;

  // Obter token de autenticação
  let authToken: string | undefined;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    authToken = session?.access_token;
  } catch (authError) {
    console.warn('⚠️ [EdgeFunctionClient] Erro ao obter sessão:', authError);
  }

  // Preparar headers
  const headers: Record<string, string> = {
    ...customHeaders,
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  let lastError: any = null;
  let attempt = 0;

  while (attempt <= retries) {
    try {
      // Criar AbortController para timeout
      const controller = new AbortController();
      const timeoutId = timeout > 0 
        ? setTimeout(() => controller.abort(), timeout)
        : null;

      const finalSignal = signal || controller.signal;

      // Log da tentativa
      if (attempt > 0) {
        console.log(`🔄 [EdgeFunctionClient] Tentativa ${attempt + 1}/${retries + 1} para ${functionName}`);
      }

      // Chamar edge function
      const { data, error } = await supabase.functions.invoke(functionName, {
        body,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
        signal: finalSignal,
      });
      const typedData = (data ?? null) as T | null;

      // Limpar timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Verificar erro HTTP
      if (error) {
        lastError = error;
        
        // Se for erro de timeout ou abort, não tentar novamente
        if (error.message?.includes('aborted') || error.message?.includes('timeout')) {
          return {
            data: null,
            error: {
              message: `Timeout ao chamar ${functionName}: ${error.message}`,
              status: error.status || 408,
              details: error,
            },
            success: false,
          };
        }

        // Se for erro 404, não tentar novamente (função não existe)
        if (error.status === 404) {
          return {
            data: null,
            error: {
              message: `Edge Function "${functionName}" não encontrada. Verifique se está deployada.`,
              status: 404,
              details: error,
            },
            success: false,
          };
        }

        // Se for erro 401/403, não tentar novamente (problema de autenticação)
        if (error.status === 401 || error.status === 403) {
          return {
            data: null,
            error: {
              message: `Erro de autenticação ao chamar ${functionName}: ${error.message}`,
              status: error.status,
              details: error,
            },
            success: false,
          };
        }

        // Para outros erros, tentar novamente se ainda houver tentativas
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
          attempt++;
          continue;
        }

        // Última tentativa falhou
        return {
          data: null,
          error: {
            message: `Erro ao chamar ${functionName}: ${error.message || 'Erro desconhecido'}`,
            status: error.status,
            details: error,
          },
          success: false,
        };
      }

      // Verificar se data indica sucesso=false
      if (typedData && typeof typedData === 'object' && 'success' in (typedData as any) && (typedData as any).success === false) {
        const errorMessage = (typedData as any).error || (typedData as any).message || 'Operação falhou';
        return {
          data: null,
          error: {
            message: errorMessage,
            status: (typedData as any).status || 500,
            details: typedData,
          },
          success: false,
        };
      }

      // Sucesso
      return {
        data: typedData,
        error: null,
        success: true,
      };

    } catch (err: any) {
      lastError = err;

      // Se for abort/timeout, não tentar novamente
      if (err.name === 'AbortError' || err.message?.includes('aborted')) {
        return {
          data: null,
          error: {
            message: `Timeout ao chamar ${functionName}`,
            status: 408,
            details: err,
          },
          success: false,
        };
      }

      // Tentar novamente se ainda houver tentativas
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
        attempt++;
        continue;
      }

      // Última tentativa falhou
      return {
        data: null,
        error: {
          message: `Erro inesperado ao chamar ${functionName}: ${err.message || 'Erro desconhecido'}`,
          status: err.status || 500,
          details: err,
        },
        success: false,
      };
    }
  }

  // Não deveria chegar aqui, mas por segurança
  return {
    data: null,
    error: {
      message: `Falha ao chamar ${functionName} após ${retries + 1} tentativas`,
      status: lastError?.status || 500,
      details: lastError,
    },
    success: false,
  };
}

/**
 * Helper para chamadas que não precisam de retry (ex: ações rápidas)
 */
export async function invokeEdgeFunctionSimple<T = any>(
  functionName: string,
  body?: any,
  headers?: Record<string, string>
): Promise<EdgeFunctionResponse<T>> {
  return invokeEdgeFunction(functionName, body, {
    retries: 0,
    timeout: 10000,
    headers,
  });
}

/**
 * Helper para chamadas que precisam de mais tentativas (ex: processamento pesado)
 */
export async function invokeEdgeFunctionWithRetry<T = any>(
  functionName: string,
  body?: any,
  options?: EdgeFunctionOptions
): Promise<EdgeFunctionResponse<T>> {
  return invokeEdgeFunction(functionName, body, {
    retries: 3,
    retryDelay: 2000,
    timeout: 60000,
    ...options,
  });
}

