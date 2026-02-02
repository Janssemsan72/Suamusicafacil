/**
 * Helper para timeouts em operações assíncronas
 */

/**
 * Executa uma promise com timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string = 'Operação excedeu o tempo limite'
): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`${errorMessage} (${timeoutMs}ms)`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]);
}

/**
 * Timeouts padrão para diferentes operações
 */
export const TIMEOUTS = {
  // Operações de banco de dados
  DATABASE_QUERY: 10000, // 10 segundos
  DATABASE_WRITE: 15000, // 15 segundos
  
  // Operações de API externa
  API_REQUEST: 30000, // 30 segundos
  EMAIL_SEND: 20000, // 20 segundos
  WHATSAPP_SEND: 30000, // 30 segundos
  
  // Operações de geração
  LYRICS_GENERATION: 60000, // 60 segundos
  AUDIO_GENERATION: 120000, // 120 segundos
  
  // Operações de webhook
  WEBHOOK_PROCESSING: 45000, // 45 segundos
} as const;

/**
 * Wrapper para fetch com timeout
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = TIMEOUTS.API_REQUEST
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout após ${timeoutMs}ms`);
    }
    throw error;
  }
}

