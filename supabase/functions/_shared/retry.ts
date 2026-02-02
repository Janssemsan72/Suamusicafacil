/**
 * Helper para retry logic em operações que podem falhar
 */

export interface RetryConfig {
  maxAttempts: number;
  delayMs: number;
  backoffMultiplier?: number; // Multiplicador para backoff exponencial
  retryableErrors?: readonly string[]; // Lista de erros que devem ser retentados
}

const DEFAULT_CONFIG: RetryConfig = {
  maxAttempts: 3,
  delayMs: 1000,
  backoffMultiplier: 2,
  retryableErrors: ['timeout', 'network', 'ECONNRESET', 'ETIMEDOUT'],
};

/**
 * Executa uma função com retry automático
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const { maxAttempts, delayMs, backoffMultiplier = 2, retryableErrors = [] } = finalConfig;

  let lastError: Error | unknown;
  let currentDelay = delayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Se não for o último attempt, verificar se deve retentar
      if (attempt < maxAttempts) {
        const shouldRetry = shouldRetryError(error, retryableErrors);
        
        if (!shouldRetry) {
          console.log(`❌ [Retry] Erro não retentável na tentativa ${attempt}/${maxAttempts}`);
          throw error;
        }

        console.log(`⚠️ [Retry] Tentativa ${attempt}/${maxAttempts} falhou, tentando novamente em ${currentDelay}ms...`);
        await sleep(currentDelay);
        currentDelay *= backoffMultiplier;
      } else {
        console.error(`❌ [Retry] Todas as ${maxAttempts} tentativas falharam`);
        throw error;
      }
    }
  }

  throw lastError;
}

/**
 * Verifica se um erro deve ser retentado
 */
function shouldRetryError(error: unknown, retryableErrors: readonly string[]): boolean {
  if (!error) return false;
  
  const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  const errorName = error instanceof Error ? error.name.toLowerCase() : '';
  
  // Verificar códigos de erro PostgreSQL/Supabase se disponível
  const errorObj = error as any;
  if (errorObj?.code) {
    // PostgreSQL error codes for retryable errors
    if (errorObj.code === '40P01') return true; // deadlock detected
    if (errorObj.code === '53300') return true; // too many connections
    if (errorObj.code === '57P03') return true; // cannot connect now
    if (errorObj.code === '08006') return true; // connection failure
    if (errorObj.code === '08003') return true; // connection does not exist
    if (errorObj.code === '08001') return true; // SQL client unable to establish SQL connection
    if (errorObj.code === 'PGRST116') return true; // connection timeout
    if (errorObj.code === '57014') return true; // statement timeout
  }
  
  // Verificar se é um erro retentável na lista
  for (const retryableError of retryableErrors) {
    if (errorMessage.includes(retryableError.toLowerCase()) || 
        errorName.includes(retryableError.toLowerCase()) ||
        errorObj?.code === retryableError) {
      return true;
    }
  }
  
  // Erros de timeout sempre devem ser retentados
  if (errorMessage.includes('timeout') || errorName.includes('timeout')) {
    return true;
  }
  
  // Erros de rede sempre devem ser retentados
  if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
    return true;
  }
  
  // Erros de conexão sempre devem ser retentados
  if (errorMessage.includes('connection') || errorMessage.includes('econnreset') || errorMessage.includes('etimedout')) {
    return true;
  }
  
  // Erros 5xx devem ser retentados
  if (error instanceof Response && error.status >= 500 && error.status < 600) {
    return true;
  }
  
  // Verificar status HTTP se disponível
  if (errorObj?.status >= 500 && errorObj?.status < 600) {
    return true;
  }
  
  return false;
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry configs pré-definidos para diferentes tipos de operações
 */
export const RETRY_CONFIGS = {
  DATABASE: {
    maxAttempts: 5, // Aumentado para operações críticas
    delayMs: 500,
    backoffMultiplier: 2,
    retryableErrors: [
      'timeout',
      'ECONNRESET',
      'ETIMEDOUT',
      '40P01', // deadlock detected
      '53300', // too many connections
      '57P03', // cannot connect now
      '08006', // connection failure
      '08003', // connection does not exist
      '08001', // SQL client unable to establish SQL connection
      'PGRST116', // connection timeout
      '57014', // statement timeout
    ],
  },
  API: {
    maxAttempts: 3,
    delayMs: 1000,
    backoffMultiplier: 2,
    retryableErrors: ['timeout', 'network', 'ECONNRESET', 'ETIMEDOUT'],
  },
  EMAIL: {
    maxAttempts: 2,
    delayMs: 2000,
    backoffMultiplier: 2,
    retryableErrors: ['timeout', 'network'],
  },
  WHATSAPP: {
    maxAttempts: 2,
    delayMs: 2000,
    backoffMultiplier: 2,
    retryableErrors: ['timeout', 'network'],
  },
} as const;

