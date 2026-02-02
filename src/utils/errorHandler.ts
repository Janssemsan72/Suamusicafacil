/**
 * Tratamento global de erros e Promise Rejections
 * Salva erros no banco de dados para análise
 */

interface ErrorLog {
  error_type: 'unhandled_rejection' | 'react_error' | 'javascript_error';
  error_message: string;
  error_stack?: string;
  page_path: string;
  user_agent?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

/**
 * Salva erro no banco de dados (REMOVIDO)
 * Motivo: a Edge Function `save-behavior-event` foi removida conforme solicitado.
 * Mantemos a função como no-op para não quebrar o fluxo de tratamento de erros.
 */
export async function logErrorToDatabase(error: ErrorLog): Promise<void> {
  try {
    // Apenas logar em dev para debug; em produção, não persistimos mais no banco.
    if (import.meta.env.DEV) {
      console.debug('🔍 [ErrorHandler] Persistência no banco removida - erro capturado:', error);
    }
  } catch (logError) {
    // Não quebrar a aplicação se falhar ao salvar erro
    console.error('❌ [ErrorHandler] Erro ao salvar erro no banco:', logError);
  }
}

/**
 * Inicializa tratamento global de erros
 */
export function setupGlobalErrorHandling(): () => void {
  // Handler para Promise Rejections não tratadas
  const handleUnhandledRejection = async (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const errorMessage = reason?.message || reason?.toString() || String(reason);
    const errorStack = reason?.stack || new Error().stack;

    // Ignorar erros conhecidos de scripts externos e CSP
    const ignoredPatterns = [
      'frame_ant.js',
      'traffic.js',
      'chrome-extension://',
      'Cannot read properties of undefined (reading \'headers\')',
      'Cannot read properties of undefined (reading \'body\')',
      'Failed to fetch dynamically imported module',
      'dynamically imported module',
      'ChunkLoadError',
      'Loading chunk',
      'Content Security Policy',
      'CSP',
      'violates the following Content Security Policy',
      'script-src',
      'removeChild',
      'insertBefore',
      'The node to be removed is not a child',
      'The node before which the new node is to be inserted is not a child',
      'NotFoundError',
      'AbortError',
      'NetworkError',
      'ResizeObserver',
      'IntersectionObserver',
    ];
    
    // ✅ CORREÇÃO: Verificar também no stack trace para erros de extensões
    const errorStackStr = errorStack?.toString() || '';
    const isChromeExtensionError = errorStackStr.includes('chrome-extension://') || 
                                   errorMessage.includes('chrome-extension://');

    const shouldIgnore = ignoredPatterns.some(pattern => 
      errorMessage.includes(pattern)
    ) || isChromeExtensionError;

    if (shouldIgnore) {
      event.preventDefault();
      // Não logar erros de extensões do Chrome
      if (!isChromeExtensionError) {
        console.debug('⚠️ [ErrorHandler] Erro ignorado (script externo):', errorMessage.substring(0, 100));
      }
      return;
    }

    // Logar erro
    console.error('❌ [ErrorHandler] Unhandled Promise Rejection:', {
      reason,
      message: errorMessage,
      stack: errorStack,
      page: window.location.pathname,
    });

    // Salvar no banco
    await logErrorToDatabase({
      error_type: 'unhandled_rejection',
      error_message: errorMessage,
      error_stack: errorStack,
      page_path: window.location.pathname,
      user_agent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      metadata: {
        reason: reason?.toString(),
        url: window.location.href,
      },
    });

    // Não prevenir o evento para que seja logado normalmente
  };

  // Handler para erros JavaScript
  const handleError = async (event: ErrorEvent) => {
    // Ignorar erros de scripts externos e CSP
    const ignoredPatterns = [
      'frame_ant.js',
      'traffic.js',
      'chrome-extension://',
      'Cannot read properties of undefined (reading \'headers\')',
      'Cannot read properties of undefined (reading \'body\')',
      'ChunkLoadError',
      'Loading chunk',
      'Content Security Policy',
      'CSP',
      'violates the following Content Security Policy',
      'script-src',
      'removeChild',
      'insertBefore',
      'The node to be removed is not a child',
      'The node before which the new node is to be inserted is not a child',
      'NotFoundError',
      'AbortError',
      'NetworkError',
      'ResizeObserver',
      'IntersectionObserver',
    ];

    // ✅ CORREÇÃO: Verificar também no stack trace para erros de extensões
    const errorStackStr = event.error?.stack?.toString() || '';
    const isChromeExtensionError = errorStackStr.includes('chrome-extension://') || 
                                   event.filename?.includes('chrome-extension://') ||
                                   event.message?.includes('chrome-extension://');
    
    const shouldIgnore = ignoredPatterns.some(pattern => 
      event.filename?.includes(pattern) || event.message?.includes(pattern)
    ) || isChromeExtensionError;

    if (shouldIgnore) {
      // Não logar erros de extensões do Chrome
      if (!isChromeExtensionError) {
        console.debug('⚠️ [ErrorHandler] Erro ignorado (script externo):', event.message?.substring(0, 100));
      }
      // Prevenir propagação de erros conhecidos de manipulação do DOM e extensões
      if (event.message?.includes('removeChild') || 
          event.message?.includes('insertBefore') ||
          isChromeExtensionError) {
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }

    console.error('❌ [ErrorHandler] JavaScript Error:', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error,
    });

    // Salvar no banco
    await logErrorToDatabase({
      error_type: 'javascript_error',
      error_message: event.message || 'Unknown error',
      error_stack: event.error?.stack,
      page_path: window.location.pathname,
      user_agent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      metadata: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        url: window.location.href,
      },
    });
  };

  // Handler específico para erros de manipulação do DOM
  const handleDOMError = (event: ErrorEvent) => {
    const errorMessage = event.message || '';
    
    // Verificar se é erro de manipulação do DOM
    if (errorMessage.includes('removeChild') || errorMessage.includes('insertBefore')) {
      // Prevenir que o erro quebre a aplicação
      event.preventDefault();
      event.stopPropagation();
      
      // Logar apenas em desenvolvimento
      if (import.meta.env.DEV) {
        console.debug('⚠️ [ErrorHandler] Erro de manipulação do DOM suprimido:', errorMessage);
      }
      
      return true;
    }
    
    return false;
  };

  // Registrar handlers
  window.addEventListener('unhandledrejection', handleUnhandledRejection);
  window.addEventListener('error', handleError);
  window.addEventListener('error', handleDOMError, true); // Usar capture phase

  // Retornar função de cleanup
  return () => {
    window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    window.removeEventListener('error', handleError);
    window.removeEventListener('error', handleDOMError, true);
  };
}



