import type { Locale } from './detectLocale';

interface CacheEntry {
  data: Record<string, any>;
  timestamp: number;
  version: string;
}

interface CacheConfig {
  maxAge: number; // em milissegundos
  maxSize: number; // número máximo de entradas
  version: string; // versão do cache para invalidação
}

class TranslationCache {
  private cache = new Map<string, CacheEntry>();
  private config: CacheConfig;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxAge: 5 * 60 * 1000, // 5 minutos
      maxSize: 10, // máximo 10 idiomas em cache
      version: '1.0.0',
      ...config
    };
  }

  /**
   * Obtém traduções do cache se válidas
   */
  get(locale: Locale): Record<string, any> | null {
    const entry = this.cache.get(locale);
    
    if (!entry) {
      if (import.meta.env.DEV) {
        console.log('🌍 [TranslationCache] Cache miss para:', locale);
      }
      return null;
    }

    // Verificar se o cache expirou
    const now = Date.now();
    if (now - entry.timestamp > this.config.maxAge) {
      if (import.meta.env.DEV) {
        console.log('🌍 [TranslationCache] Cache expirado para:', locale);
      }
      this.cache.delete(locale);
      return null;
    }

    // Verificar versão
    if (entry.version !== this.config.version) {
      if (import.meta.env.DEV) {
        console.log('🌍 [TranslationCache] Versão do cache desatualizada para:', locale);
      }
      this.cache.delete(locale);
      return null;
    }

    if (import.meta.env.DEV) {
      console.log('🌍 [TranslationCache] Cache hit para:', locale);
    }
    return entry.data;
  }

  /**
   * Armazena traduções no cache
   */
  set(locale: Locale, data: Record<string, any>): void {
    // Limpar cache se exceder o tamanho máximo
    if (this.cache.size >= this.config.maxSize) {
      this.cleanup();
    }

    const entry: CacheEntry = {
      data: { ...data }, // deep copy para evitar mutação
      timestamp: Date.now(),
      version: this.config.version
    };

    this.cache.set(locale, entry);
    if (import.meta.env.DEV) {
      console.log('🌍 [TranslationCache] Cache armazenado para:', locale);
    }
  }

  /**
   * Remove entradas expiradas do cache
   */
  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.config.maxAge) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => {
      this.cache.delete(key);
      if (import.meta.env.DEV) {
        console.log('🌍 [TranslationCache] Removido cache expirado:', key);
      }
    });

    // Se ainda exceder o tamanho, remover os mais antigos
    if (this.cache.size >= this.config.maxSize) {
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = entries.slice(0, this.cache.size - this.config.maxSize + 1);
      toRemove.forEach(([key]) => {
        this.cache.delete(key);
        if (import.meta.env.DEV) {
          console.log('🌍 [TranslationCache] Removido cache antigo:', key);
        }
      });
    }
  }

  /**
   * Limpa todo o cache
   */
  clear(): void {
    this.cache.clear();
    if (import.meta.env.DEV) {
      console.log('🌍 [TranslationCache] Cache limpo');
    }
  }

  /**
   * Obtém estatísticas do cache
   */
  getStats(): {
    size: number;
    maxSize: number;
    entries: Array<{
      locale: string;
      age: number;
      version: string;
    }>;
  } {
    const now = Date.now();
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      entries: Array.from(this.cache.entries()).map(([locale, entry]) => ({
        locale,
        age: now - entry.timestamp,
        version: entry.version
      }))
    };
  }

  /**
   * Verifica se um locale está em cache
   */
  has(locale: Locale): boolean {
    const entry = this.cache.get(locale);
    if (!entry) return false;

    const now = Date.now();
    return (now - entry.timestamp <= this.config.maxAge) && 
           (entry.version === this.config.version);
  }
}

// Instância singleton do cache
export const translationCache = new TranslationCache({
  maxAge: 10 * 60 * 1000, // 10 minutos
  maxSize: 5, // máximo 5 idiomas
  version: '1.0.0'
});

export default translationCache;

