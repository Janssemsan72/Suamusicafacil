/**
 * Configuração para suprimir erros conhecidos e não críticos
 * Especialmente útil para erros de tracking em desenvolvimento
 */

const isDev = import.meta.env.DEV;
const allowConsole = import.meta.env.VITE_ALLOW_CONSOLE === 'true';

function getFetchUrl(input: unknown): string {
  try {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.toString();
    if (input instanceof Request) return input.url;
    const anyInput = input as any;
    if (anyInput && typeof anyInput.url === 'string') return anyInput.url;
    return String(input ?? '');
  } catch {
    return '';
  }
}

function isAbortLikeError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  const anyError = error as any;
  if (typeof anyError?.name === 'string' && anyError.name === 'AbortError') return true;
  const message = String(anyError?.message ?? anyError ?? '');
  return message.includes('ERR_ABORTED') || message.includes('AbortError') || message.toLowerCase().includes('aborted');
}

function isViteDevPingUrl(url: string): boolean {
  if (typeof window === 'undefined') return false;
  const normalized = String(url || '');
  if (normalized === `${window.location.origin}/`) return true;
  return /^https?:\/\/(localhost|127\.0\.0\.1):\d+\/?$/.test(normalized);
}

/**
 * Verifica se o erro é de conexão recusada (servidor não disponível)
 * Usado para suprimir erros do HMR quando o dev server está parado
 */
function isConnectionRefusedError(error: unknown): boolean {
  if (!error) return false;
  const message = String((error as any)?.message ?? (error as any) ?? '');
  return (
    message.includes('ERR_CONNECTION_REFUSED') ||
    message.includes('net::ERR_CONNECTION_REFUSED') ||
    message.includes('Failed to fetch')
  );
}

/**
 * Verifica se o erro é um 404/400 do Supabase para tabelas que não existem
 */
function isSupabaseTableNotFoundError(url: string, status: number): boolean {
  if (!isDev) return false;
  
  // Tabelas que podem não existir e são esperadas
  const expectedMissingTables = [
    '/faqs',
    '/example_tracks',
    '/testimonials',
  ];
  
  // URLs de storage com undefined também devem ser suprimidas
  const isStorageUndefined = url.includes('/storage/v1/object/public/') && url.includes('/undefined');
  
  // Verificar se é uma requisição para uma dessas tabelas e retornou 404 ou 400
  const isExpectedTable = expectedMissingTables.some(table => url.includes(table));
  const isNotFoundError = status === 404 || status === 400;
  
  return (isExpectedTable && isNotFoundError) || (isStorageUndefined && isNotFoundError);
}

export function setupErrorSuppression() {
  // ✅ Modo silencioso apenas em DEV (evitar ruído de HMR, tracking, etc.)
  // Em produção, manter console para debug. Para silenciar em prod, defina VITE_ALLOW_CONSOLE=false
  if (isDev && typeof console !== 'undefined' && !allowConsole) {
    const original = {
      log: console.log,
      info: console.info,
      debug: console.debug,
      warn: console.warn,
      error: console.error,
    };
    console.log = () => {};
    console.info = () => {};
    console.debug = () => {};
    console.warn = () => {};
    console.error = () => {};
    (window as any).__originalConsole = original;
  }

  // Handler para promises rejeitadas (fetch failures, etc)
  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const message = String(reason?.message ?? reason ?? '');
    const stack = String(reason?.stack ?? '');
    // Suprimir rejeições de HMR ping (client:, waitForSuccessfulPing, ping)
    const isHmrPingRejection =
      (message.includes('ERR_CONNECTION_REFUSED') || message.includes('Failed to fetch')) &&
      (stack.includes('@vite/client') || stack.includes('client:') || stack.includes('waitForSuccessfulPing') || stack.includes('ping'));
    if (isHmrPingRejection) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  
  // Handler para erros de rede (fetch, XMLHttpRequest, etc)
  const handleError = (event: ErrorEvent) => {
    const errorMessage = event.message || String(event.error || '');
    const errorSource = event.filename || '';
    
    // Suprimir ERR_CONNECTION_REFUSED em pings do HMR (servidor dev parado)
    if (
      (errorMessage.includes('ERR_CONNECTION_REFUSED') || errorMessage.includes('net::ERR_CONNECTION_REFUSED')) &&
      (errorSource.includes('@vite/client') || errorSource.includes('client') || errorSource.includes('requests.js'))
    ) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    
    // Verificar se é erro do Supabase para tabelas esperadas
    if (errorSource.includes('supabase.co') || errorMessage.includes('supabase.co')) {
      const isExpectedTable = ['faqs', 'example_tracks', 'testimonials', '/undefined'].some(table => 
        errorSource.includes(table) || errorMessage.includes(table)
      );
      
      if (isExpectedTable) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
    }
  };
  
  // Interceptar fetch para suprimir erros do Supabase
  let originalFetch: typeof window.fetch | null = null;
  if (isDev && typeof window !== 'undefined') {
    originalFetch = window.fetch;
    window.fetch = async function(...args) {
      const url = getFetchUrl(args[0]);
      
      try {
        const response = await originalFetch!.apply(this, args);
        
        // Verificar se é um erro 404/400 do Supabase para tabelas esperadas
        if (isSupabaseTableNotFoundError(url, response.status)) {
          // Retornar resposta vazia mas com status 404 para o código tratar
          return new Response(JSON.stringify([]), { 
            status: 404, 
            statusText: 'Not Found',
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        return response;
      } catch (error: any) {
        if (isAbortLikeError(error) && isViteDevPingUrl(url)) {
          return new Response(null, { status: 204, statusText: 'No Content' });
        }
        // Suprimir ERR_CONNECTION_REFUSED em pings do HMR (servidor dev parado)
        if (isViteDevPingUrl(url) && isConnectionRefusedError(error)) {
          return new Response(null, { status: 204, statusText: 'No Content' });
        }
        throw error;
      }
    };
    
    // Salvar referência para cleanup
    (window as any).__originalFetch = originalFetch;
  }
  
  // Interceptar console.error para suprimir erros do Supabase
  if (isDev && typeof console !== 'undefined') {
    const originalConsoleError = console.error;
    console.error = function(...args: any[]) {
      const errorMessage = args.join(' ');

      if (errorMessage.includes('net::ERR_ABORTED') && errorMessage.includes('@vite/client')) {
        return;
      }

      // Suprimir ERR_CONNECTION_REFUSED em pings do HMR (servidor dev parado)
      if (
        (errorMessage.includes('ERR_CONNECTION_REFUSED') || errorMessage.includes('net::ERR_CONNECTION_REFUSED')) &&
        (errorMessage.includes('127.0.0.1') || errorMessage.includes('localhost'))
      ) {
        return;
      }
      
      // Verificar se é um erro 404/400 do Supabase para tabelas esperadas
      if (errorMessage.includes('404') || errorMessage.includes('400')) {
        const isSupabaseError = errorMessage.includes('supabase.co');
        const isExpectedTable = ['faqs', 'example_tracks', 'testimonials', '/undefined'].some(table => 
          errorMessage.includes(table)
        );
        
        if (isSupabaseError && isExpectedTable) {
          // Suprimir o erro
          return;
        }
      }
      
      // Suprimir erros relacionados a URL de audio inacessível
      if (errorMessage.includes('URL del audio no accesible') || 
          errorMessage.includes('URL de audio inválida')) {
        return;
      }
      
      // Chamar o console.error original para outros erros
      originalConsoleError.apply(console, args);
    };
    
    // Salvar referência para cleanup
    (window as any).__originalConsoleError = originalConsoleError;
  }
  
  // Nota: console já é silenciado acima por padrão em dev.
  
  // Registrar handlers
  window.addEventListener('unhandledrejection', handleUnhandledRejection);
  window.addEventListener('error', handleError, true); // Usar capture phase
  
  // Retornar função de cleanup
  return () => {
    window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    window.removeEventListener('error', handleError, true);
    
    // Restaurar fetch original se necessário
    if (isDev && typeof window !== 'undefined' && (window as any).__originalFetch) {
      window.fetch = (window as any).__originalFetch;
    }
    
    // Restaurar console original se necessário
    if (isDev && typeof window !== 'undefined' && (window as any).__originalConsole) {
      const original = (window as any).__originalConsole;
      console.log = original.log;
      console.info = original.info;
      console.debug = original.debug;
      console.warn = original.warn;
      console.error = original.error;
    }
  };
}
