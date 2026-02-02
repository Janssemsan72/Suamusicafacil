/**
 * ✅ CORREÇÃO CACHE: Limpeza automática de cache para garantir acesso correto
 * Especialmente importante para clientes que já compraram
 */

const APP_VERSION_KEY = 'suamusicafacil_app_version';
const BUILD_HASH_KEY = 'suamusicafacil_build_hash'; // ✅ CACHE BUSTING: Hash de build do servidor
const LAST_CLEANUP_KEY = 'suamusicafacil_last_cleanup';
const CURRENT_APP_VERSION = '2.0.0'; // Incrementar quando houver mudanças que requerem limpeza
const VERSION_CHECK_TIMEOUT = 2000; // 2 segundos timeout para verificação

/**
 * Verifica se precisa limpar cache baseado na versão do app
 */
function needsVersionCleanup(): boolean {
  try {
    const storedVersion = localStorage.getItem(APP_VERSION_KEY);
    if (!storedVersion) {
      // Primeira vez, marcar versão atual
      localStorage.setItem(APP_VERSION_KEY, CURRENT_APP_VERSION);
      return false;
    }
    
    // Se versão mudou, precisa limpar cache
    if (storedVersion !== CURRENT_APP_VERSION) {
      console.log(`[AutoCacheCleanup] Versão mudou de ${storedVersion} para ${CURRENT_APP_VERSION}, limpando cache...`);
      localStorage.setItem(APP_VERSION_KEY, CURRENT_APP_VERSION);
      return true;
    }
    
    return false;
  } catch (error) {
    console.warn('[AutoCacheCleanup] Erro ao verificar versão:', error);
    return false;
  }
}

/**
 * Verifica se precisa limpar cache baseado no tempo (limpeza periódica)
 */
function needsPeriodicCleanup(): boolean {
  try {
    const lastCleanup = localStorage.getItem(LAST_CLEANUP_KEY);
    if (!lastCleanup) {
      return true; // Nunca limpou, limpar agora
    }
    
    const lastCleanupDate = new Date(lastCleanup);
    const now = new Date();
    const daysSinceCleanup = (now.getTime() - lastCleanupDate.getTime()) / (1000 * 60 * 60 * 24);
    
    // Limpar cache a cada 7 dias para evitar acúmulo
    if (daysSinceCleanup >= 7) {
      console.log(`[AutoCacheCleanup] Passaram ${Math.floor(daysSinceCleanup)} dias desde última limpeza, limpando cache...`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.warn('[AutoCacheCleanup] Erro ao verificar limpeza periódica:', error);
    return false;
  }
}

/**
 * Limpa todos os caches do navegador
 */
async function clearAllCaches(): Promise<void> {
  try {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      if (cacheNames.length > 0) {
        console.log(`[AutoCacheCleanup] Limpando ${cacheNames.length} cache(s)...`);
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        console.log('[AutoCacheCleanup] ✅ Todos os caches limpos');
      }
    }
  } catch (error) {
    console.warn('[AutoCacheCleanup] Erro ao limpar caches:', error);
  }
}

/**
 * Limpa Service Workers que possam interferir (exceto admin)
 */
async function clearInterferingServiceWorkers(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      const publicRegistrations = registrations.filter(reg => 
        !reg.scope.includes('/admin') && 
        window.location.pathname.startsWith('/admin') === false
      );
      
      if (publicRegistrations.length > 0) {
        console.log(`[AutoCacheCleanup] Removendo ${publicRegistrations.length} Service Worker(s) interferente(s)...`);
        await Promise.all(publicRegistrations.map(reg => reg.unregister()));
        console.log('[AutoCacheCleanup] ✅ Service Workers removidos');
      }
    }
  } catch (error) {
    console.warn('[AutoCacheCleanup] Erro ao limpar Service Workers:', error);
  }
}

/**
 * Limpa dados antigos do localStorage (mantém apenas essenciais)
 */
function clearOldLocalStorageData(): void {
  try {
    const keysToKeep = [
      'suamusicafacil_language',
      'pending_quiz', // Manter quiz pendente
      'editing_order_id',
      'editing_quiz_id',
      'editing_token',
      APP_VERSION_KEY,
      BUILD_HASH_KEY, // ✅ CACHE BUSTING: Manter hash de build
      LAST_CLEANUP_KEY,
    ];
    
    const allKeys = Object.keys(localStorage);
    const keysToRemove = allKeys.filter(key => !keysToKeep.includes(key));
    
    // Remover chaves antigas que não são essenciais
    const oldKeys = keysToRemove.filter(key => 
      key.startsWith('quiz_') && key !== 'pending_quiz' ||
      key.startsWith('sync_') ||
      key.includes('cache') ||
      key.includes('old_') ||
      key.includes('temp_')
    );
    
    if (oldKeys.length > 0) {
      console.log(`[AutoCacheCleanup] Removendo ${oldKeys.length} chave(s) antiga(s) do localStorage...`);
      oldKeys.forEach(key => {
        try {
          localStorage.removeItem(key);
        } catch (e) {
          // Ignorar erro individual
        }
      });
      console.log('[AutoCacheCleanup] ✅ Dados antigos removidos do localStorage');
    }
  } catch (error) {
    console.warn('[AutoCacheCleanup] Erro ao limpar localStorage:', error);
  }
}

/**
 * ✅ CACHE BUSTING: Extrai hash de versão do HTML
 */
function extractVersionFromHTML(html: string): string | null {
  // Tentar extrair do comentário HTML primeiro
  const commentMatch = html.match(/<!--\s*APP_VERSION:\s*([^\s]+)\s*-->/);
  if (commentMatch && commentMatch[1]) {
    return commentMatch[1];
  }
  
  // Tentar extrair da meta tag
  const metaMatch = html.match(/<meta\s+name=["']app-version["']\s+content=["']([^"']+)["']/i);
  if (metaMatch && metaMatch[1]) {
    return metaMatch[1];
  }
  
  return null;
}

/**
 * ✅ CACHE BUSTING: Verifica versão do servidor fazendo fetch do HTML
 * Retorna true se versão mudou e precisa recarregar
 */
export async function checkServerVersion(): Promise<boolean> {
  try {
    // Fazer fetch do index.html com cache busting
    // ✅ CORREÇÃO: Preservar parâmetros UTM e tracking, remover apenas 'v='
    const currentUrl = new URL(window.location.href);
    // Remover parâmetro 'v' se existir
    currentUrl.searchParams.delete('v');
    // Adicionar timestamp para cache busting
    currentUrl.searchParams.set('_cb', Date.now().toString());
    const url = currentUrl.toString();
    
    // Usar fetch com timeout
    const fetchPromise = fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    const timeoutPromise = new Promise<Response>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Timeout'));
      }, VERSION_CHECK_TIMEOUT);
    });
    
    const response = await Promise.race([fetchPromise, timeoutPromise]);
    
    if (!response || !response.ok) {
      return false;
    }
    
    const html = await response.text();
    if (!html) {
      return false;
    }
    
    const serverHash = extractVersionFromHTML(html);
    if (!serverHash) {
      return false;
    }
    
    // Comparar com hash armazenado
    let storedHash: string | null = null;
    try {
      storedHash = localStorage.getItem(BUILD_HASH_KEY);
    } catch (e) {
      // localStorage pode estar bloqueado, continuar
    }
    
    // Se hash diferente, precisa recarregar
    if (storedHash !== serverHash) {
      console.log(`[AutoCacheCleanup] Nova versão detectada! Hash servidor: ${serverHash}, Hash local: ${storedHash}`);
      
      // Salvar novo hash
      try {
        localStorage.setItem(BUILD_HASH_KEY, serverHash);
      } catch (e) {
        // Ignorar se localStorage bloqueado
      }
      
      return true;
    }
    
    return false;
  } catch (error) {
    // Timeout ou erro de rede - não bloquear carregamento
    console.debug('[AutoCacheCleanup] Erro ao verificar versão do servidor:', error);
    return false;
  }
}

/**
 * ✅ CACHE BUSTING: Verifica versão do servidor e força reload se necessário
 */
export async function checkAndReloadIfNeeded(): Promise<void> {
  try {
    const needsReload = await checkServerVersion();
    
    if (needsReload) {
      console.log('[AutoCacheCleanup] 🔄 Nova versão detectada, limpando cache e recarregando...');
      
      // Limpar todos os caches
      await clearAllCaches();
      await clearInterferingServiceWorkers();
      clearOldLocalStorageData();
      clearOldSessionStorageData();
      
      // Recarregar página
      const reloadUrl = window.location.href.split('?')[0];
      const newUrl = reloadUrl + (reloadUrl.indexOf('?') === -1 ? '?' : '&') + 'v=' + Date.now();
      
      setTimeout(() => {
        window.location.href = newUrl;
      }, 100);
    }
  } catch (error) {
    console.warn('[AutoCacheCleanup] Erro ao verificar e recarregar:', error);
  }
}

/**
 * Limpa sessionStorage antigo
 */
function clearOldSessionStorageData(): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const keysToKeep = ['pending_quiz']; // Manter apenas quiz pendente
      const allKeys = Object.keys(sessionStorage);
      const keysToRemove = allKeys.filter(key => !keysToKeep.includes(key));
      
      if (keysToRemove.length > 0) {
        console.log(`[AutoCacheCleanup] Removendo ${keysToRemove.length} chave(s) antiga(s) do sessionStorage...`);
        keysToRemove.forEach(key => {
          try {
            sessionStorage.removeItem(key);
          } catch (e) {
            // Ignorar erro individual
          }
        });
      }
    }
  } catch (error) {
    console.warn('[AutoCacheCleanup] Erro ao limpar sessionStorage:', error);
  }
}

/**
 * Executa limpeza automática completa
 */
export async function performAutoCacheCleanup(options: {
  force?: boolean;
  silent?: boolean;
} = {}): Promise<void> {
  const { force = false, silent = false } = options;
  
  try {
    // Verificar se precisa limpar
    const needsCleanup = force || needsVersionCleanup() || needsPeriodicCleanup();
    
    if (!needsCleanup && !force) {
      if (!silent) {
        console.log('[AutoCacheCleanup] Cache está atualizado, não precisa limpar');
      }
      return;
    }
    
    if (!silent) {
      console.log('[AutoCacheCleanup] 🧹 Iniciando limpeza automática de cache...');
    }
    
    // 1. Limpar caches do navegador
    await clearAllCaches();
    
    // 2. Limpar Service Workers interferentes
    await clearInterferingServiceWorkers();
    
    // 3. Limpar dados antigos do localStorage
    clearOldLocalStorageData();
    
    // 4. Limpar dados antigos do sessionStorage
    clearOldSessionStorageData();
    
    // 5. Marcar última limpeza
    try {
      localStorage.setItem(LAST_CLEANUP_KEY, new Date().toISOString());
    } catch (e) {
      // Ignorar erro
    }
    
    if (!silent) {
      console.log('[AutoCacheCleanup] ✅ Limpeza automática concluída');
    }
  } catch (error) {
    console.error('[AutoCacheCleanup] ❌ Erro na limpeza automática:', error);
  }
}

/**
 * Inicializa limpeza automática ao carregar a página
 * Deve ser chamado no início do App
 */
export function initAutoCacheCleanup(): void {
  // ✅ CACHE BUSTING: Verificar versão do servidor primeiro
  setTimeout(() => {
    checkAndReloadIfNeeded().catch(error => {
      console.warn('[AutoCacheCleanup] Erro ao verificar versão:', error);
    });
  }, 500);
  
  // Executar limpeza automática após um pequeno delay para não bloquear carregamento
  setTimeout(() => {
    performAutoCacheCleanup({ silent: true }).catch(error => {
      console.warn('[AutoCacheCleanup] Erro na inicialização:', error);
    });
  }, 1000);
  
  // Também executar quando a página ganha foco (cliente volta para a aba)
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', () => {
      // ✅ CACHE BUSTING: Verificar versão quando cliente volta
      checkAndReloadIfNeeded().catch(error => {
        console.warn('[AutoCacheCleanup] Erro ao verificar versão ao focar:', error);
      });
      
      // Verificar se precisa limpar quando cliente volta
      if (needsPeriodicCleanup()) {
        performAutoCacheCleanup({ silent: true }).catch(error => {
          console.warn('[AutoCacheCleanup] Erro na limpeza ao focar:', error);
        });
      }
    });
  }
  
  // ✅ CACHE BUSTING: Verificar versão periodicamente (a cada 5 minutos)
  if (typeof window !== 'undefined') {
    setInterval(() => {
      checkAndReloadIfNeeded().catch(error => {
        console.warn('[AutoCacheCleanup] Erro na verificação periódica:', error);
      });
    }, 5 * 60 * 1000); // 5 minutos
  }
}

/**
 * Força limpeza completa (útil para clientes que já compraram e estão com problemas)
 */
export async function forceCacheCleanup(): Promise<void> {
  console.log('[AutoCacheCleanup] 🔄 Forçando limpeza completa de cache...');
  await performAutoCacheCleanup({ force: true, silent: false });
  
  // Recarregar página após limpeza forçada
  setTimeout(() => {
    window.location.reload();
  }, 500);
}

