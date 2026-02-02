/**
 * ✅ FASE 7: Fallbacks para APIs modernas
 * Garante que funcionalidades críticas sempre funcionem
 */

/**
 * Fetch com fallback para XMLHttpRequest
 */
export function universalFetch(
  url: string,
  options?: RequestInit
): Promise<Response> {
  if (typeof fetch !== 'undefined') {
    return fetch(url, options);
  }
  
  // Fallback para XMLHttpRequest
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const method = options?.method || 'GET';
    
    xhr.open(method, url);
    
    // Adicionar headers
    if (options?.headers) {
      Object.keys(options.headers).forEach(key => {
        const value = options.headers![key];
        if (typeof value === 'string') {
          xhr.setRequestHeader(key, value);
        }
      });
    }
    
    xhr.onload = function() {
      const response = new Response(xhr.responseText, {
        status: xhr.status,
        statusText: xhr.statusText,
        headers: new Headers()
      });
      resolve(response);
    };
    
    xhr.onerror = function() {
      reject(new Error('Network request failed'));
    };
    
    xhr.send(options?.body as any);
  });
}

/**
 * LocalStorage com fallback para cookies e memória
 */
class UniversalStorage {
  private memoryStorage: { [key: string]: string } = {};
  
  getItem(key: string): string | null {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(key);
      }
    } catch (e) {
      // localStorage pode estar bloqueado
    }
    
    // Fallback para cookies
    try {
      const cookies = document.cookie.split(';');
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i].trim();
        if (cookie.startsWith(key + '=')) {
          return decodeURIComponent(cookie.substring(key.length + 1));
        }
      }
    } catch (e) {
      // Cookies podem estar bloqueados
    }
    
    // Fallback para memória
    return this.memoryStorage[key] || null;
  }
  
  setItem(key: string, value: string): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
        return;
      }
    } catch (e) {
      // localStorage pode estar bloqueado ou cheio
    }
    
    // Fallback para cookies
    try {
      const expires = new Date();
      expires.setTime(expires.getTime() + (365 * 24 * 60 * 60 * 1000)); // 1 ano
      document.cookie = `${key}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/`;
      return;
    } catch (e) {
      // Cookies podem estar bloqueados
    }
    
    // Fallback para memória
    this.memoryStorage[key] = value;
  }
  
  removeItem(key: string): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
    } catch (e) {
      // Ignorar erro
    }
    
    // Remover de cookies
    try {
      document.cookie = `${key}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
    } catch (e) {
      // Ignorar erro
    }
    
    // Remover da memória
    delete this.memoryStorage[key];
  }
  
  clear(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.clear();
      }
    } catch (e) {
      // Ignorar erro
    }
    
    // Limpar memória
    this.memoryStorage = {};
  }
  
  get length(): number {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.length;
      }
    } catch (e) {
      // Ignorar erro
    }
    
    return Object.keys(this.memoryStorage).length;
  }
  
  key(index: number): string | null {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.key(index);
      }
    } catch (e) {
      // Ignorar erro
    }
    
    const keys = Object.keys(this.memoryStorage);
    return keys[index] || null;
  }
}

export const universalStorage = new UniversalStorage();

/**
 * History API com fallback para hash routing
 */
export class UniversalHistory {
  private useHash: boolean;
  
  constructor() {
    // Verificar se History API está disponível
    this.useHash = !(typeof window !== 'undefined' && 
                     window.history && 
                     window.history.pushState);
  }
  
  push(path: string): void {
    if (this.useHash) {
      window.location.hash = path;
    } else {
      window.history.pushState({}, '', path);
    }
  }
  
  replace(path: string): void {
    if (this.useHash) {
      window.location.replace('#' + path);
    } else {
      window.history.replaceState({}, '', path);
    }
  }
  
  getCurrentPath(): string {
    if (this.useHash) {
      return window.location.hash.substring(1) || '/';
    } else {
      return window.location.pathname + window.location.search;
    }
  }
  
  listen(callback: (path: string) => void): () => void {
    if (this.useHash) {
      const handler = () => {
        callback(this.getCurrentPath());
      };
      window.addEventListener('hashchange', handler);
      return () => {
        window.removeEventListener('hashchange', handler);
      };
    } else {
      const handler = () => {
        callback(this.getCurrentPath());
      };
      window.addEventListener('popstate', handler);
      return () => {
        window.removeEventListener('popstate', handler);
      };
    }
  }
}

export const universalHistory = new UniversalHistory();



