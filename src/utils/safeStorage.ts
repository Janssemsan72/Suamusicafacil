/**
 * ✅ FASE 4: Wrapper seguro para localStorage/sessionStorage
 * Sempre verifica disponibilidade antes de usar
 */

/**
 * Wrapper seguro para localStorage
 */
export const safeLocalStorage = {
  getItem(key: string): string | null {
    try {
      if (typeof localStorage === 'undefined') {
        return null;
      }
      return localStorage.getItem(key);
    } catch (e) {
      console.warn('[SafeStorage] Erro ao ler localStorage:', e);
      return null;
    }
  },
  
  setItem(key: string, value: string): boolean {
    try {
      if (typeof localStorage === 'undefined') {
        console.warn('[SafeStorage] localStorage não disponível');
        return false;
      }
      localStorage.setItem(key, value);
      // Verificar se foi salvo
      const saved = localStorage.getItem(key);
      if (saved !== value) {
        console.warn('[SafeStorage] Valor não foi salvo corretamente');
        return false;
      }
      return true;
    } catch (e: any) {
      console.warn('[SafeStorage] Erro ao salvar no localStorage:', e);
      if (e.name === 'QuotaExceededError') {
        console.warn('[SafeStorage] Quota excedida, tentando limpar espaço...');
        // Tentar limpar chaves antigas
        try {
          const keys = Object.keys(localStorage);
          const oldKeys = keys.filter(k => 
            k.startsWith('quiz_') || 
            k.startsWith('temp_') ||
            k.startsWith('old_')
          );
          oldKeys.slice(0, 5).forEach(k => localStorage.removeItem(k));
          // Tentar novamente
          localStorage.setItem(key, value);
          return true;
        } catch (retryError) {
          console.error('[SafeStorage] Falha ao limpar e salvar:', retryError);
          return false;
        }
      }
      return false;
    }
  },
  
  removeItem(key: string): boolean {
    try {
      if (typeof localStorage === 'undefined') {
        return false;
      }
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.warn('[SafeStorage] Erro ao remover do localStorage:', e);
      return false;
    }
  },
  
  clear(): boolean {
    try {
      if (typeof localStorage === 'undefined') {
        return false;
      }
      localStorage.clear();
      return true;
    } catch (e) {
      console.warn('[SafeStorage] Erro ao limpar localStorage:', e);
      return false;
    }
  },
  
  key(index: number): string | null {
    try {
      if (typeof localStorage === 'undefined') {
        return null;
      }
      return localStorage.key(index);
    } catch (e) {
      console.warn('[SafeStorage] Erro ao obter chave do localStorage:', e);
      return null;
    }
  },
  
  get length(): number {
    try {
      if (typeof localStorage === 'undefined') {
        return 0;
      }
      return localStorage.length;
    } catch (e) {
      return 0;
    }
  }
};

/**
 * Wrapper seguro para sessionStorage
 */
export const safeSessionStorage = {
  getItem(key: string): string | null {
    try {
      if (typeof sessionStorage === 'undefined') {
        return null;
      }
      return sessionStorage.getItem(key);
    } catch (e) {
      console.warn('[SafeStorage] Erro ao ler sessionStorage:', e);
      return null;
    }
  },
  
  setItem(key: string, value: string): boolean {
    try {
      if (typeof sessionStorage === 'undefined') {
        console.warn('[SafeStorage] sessionStorage não disponível');
        return false;
      }
      sessionStorage.setItem(key, value);
      return true;
    } catch (e) {
      console.warn('[SafeStorage] Erro ao salvar no sessionStorage:', e);
      return false;
    }
  },
  
  removeItem(key: string): boolean {
    try {
      if (typeof sessionStorage === 'undefined') {
        return false;
      }
      sessionStorage.removeItem(key);
      return true;
    } catch (e) {
      console.warn('[SafeStorage] Erro ao remover do sessionStorage:', e);
      return false;
    }
  },
  
  clear(): boolean {
    try {
      if (typeof sessionStorage === 'undefined') {
        return false;
      }
      sessionStorage.clear();
      return true;
    } catch (e) {
      console.warn('[SafeStorage] Erro ao limpar sessionStorage:', e);
      return false;
    }
  },
  
  key(index: number): string | null {
    try {
      if (typeof sessionStorage === 'undefined') {
        return null;
      }
      return sessionStorage.key(index);
    } catch (e) {
      console.warn('[SafeStorage] Erro ao obter chave do sessionStorage:', e);
      return null;
    }
  },
  
  get length(): number {
    try {
      if (typeof sessionStorage === 'undefined') {
        return 0;
      }
      return sessionStorage.length;
    } catch (e) {
      return 0;
    }
  }
};



