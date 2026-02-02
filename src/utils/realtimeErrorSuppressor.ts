/**
 * Utilitário para suprimir logs repetitivos de erros de WebSocket/Realtime
 * Evita poluir o console com centenas de mensagens de erro idênticas
 */

interface ErrorCount {
  count: number;
  lastLogged: number;
  suppressed: number;
}

const errorCounts = new Map<string, ErrorCount>();
const MAX_LOGS_PER_ERROR = 3; // Logar apenas as primeiras 3 ocorrências
const SUPPRESSION_WINDOW_MS = 60000; // 1 minuto - resetar contador após 1 minuto sem erros

/**
 * Suprime logs repetitivos de erro de WebSocket
 * @param errorKey - Chave única para identificar o tipo de erro
 * @param logFn - Função de log a ser chamada (console.warn, console.error, etc.)
 * @param message - Mensagem a ser logada
 * @param data - Dados adicionais para o log
 */
export function suppressRealtimeError(
  errorKey: string,
  logFn: (...args: any[]) => void,
  message: string,
  data?: any
): void {
  const now = Date.now();
  const errorInfo = errorCounts.get(errorKey);

  if (!errorInfo) {
    // Primeira ocorrência - logar normalmente
    errorCounts.set(errorKey, {
      count: 1,
      lastLogged: now,
      suppressed: 0
    });
    if (data) {
      logFn(message, ...(Array.isArray(data) ? data : [data]));
    } else {
      logFn(message);
    }
    return;
  }

  // Resetar contador se passou muito tempo desde o último erro
  if (now - errorInfo.lastLogged > SUPPRESSION_WINDOW_MS) {
    errorInfo.count = 1;
    errorInfo.lastLogged = now;
    errorInfo.suppressed = 0;
    if (data) {
      logFn(message, ...(Array.isArray(data) ? data : [data]));
    } else {
      logFn(message);
    }
    return;
  }

  errorInfo.count++;

  // Logar apenas as primeiras N ocorrências
  if (errorInfo.count <= MAX_LOGS_PER_ERROR) {
    errorInfo.lastLogged = now;
    if (data) {
      logFn(message, ...(Array.isArray(data) ? data : [data]));
    } else {
      logFn(message);
    }
  } else {
    // Suprimir logs adicionais, mas atualizar contador
    errorInfo.suppressed++;
    errorInfo.lastLogged = now;

    // Logar resumo a cada 10 erros suprimidos
    if (errorInfo.suppressed % 10 === 0) {
      logFn(
        `⚠️ [Realtime] Erro repetitivo suprimido (${errorInfo.suppressed} ocorrências). ` +
        `Usando polling como fallback. Erro: ${errorKey}`
      );
    }
  }
}

/**
 * Limpa o contador de erros para uma chave específica
 * Útil quando o erro é resolvido
 */
export function clearErrorCount(errorKey: string): void {
  errorCounts.delete(errorKey);
}

/**
 * Limpa todos os contadores de erro
 */
export function clearAllErrorCounts(): void {
  errorCounts.clear();
}

/**
 * Obtém estatísticas de erros suprimidos
 */
export function getErrorStats(): Record<string, { count: number; suppressed: number }> {
  const stats: Record<string, { count: number; suppressed: number }> = {};
  errorCounts.forEach((value, key) => {
    stats[key] = {
      count: value.count,
      suppressed: value.suppressed
    };
  });
  return stats;
}

