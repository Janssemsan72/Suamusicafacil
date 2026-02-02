/**
 * Sistema de Cache Robusto - Persistência com IndexedDB
 * 
 * Usa IndexedDB para persistir cache entre sessões
 * Fallback para localStorage se IndexedDB não estiver disponível
 */

import type { CacheEntry, CacheStrategy } from './types';

const DB_NAME = 'musiclovely_admin_cache';
const DB_VERSION = 1;
const STORE_NAME = 'cache_entries';

interface DBPromise {
  resolve: (db: IDBDatabase) => void;
  reject: (error: Error) => void;
}

class CacheStorage {
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Inicializa o IndexedDB
   */
  async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        console.warn('⚠️ [CacheStorage] IndexedDB não disponível, usando localStorage');
        resolve();
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('❌ [CacheStorage] Erro ao abrir IndexedDB:', request.error);
        reject(request.error || new Error('Erro ao abrir IndexedDB'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ [CacheStorage] IndexedDB inicializado');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Criar object store se não existir
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          store.createIndex('strategy', 'strategy', { unique: false });
          store.createIndex('tags', 'tags', { unique: false, multiEntry: true });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          console.log('✅ [CacheStorage] Object store criado');
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Obtém uma entrada do cache
   */
  async get<T = any>(key: string): Promise<CacheEntry<T> | null> {
    await this.init();

    // Tentar IndexedDB primeiro
    if (this.db) {
      try {
        return new Promise((resolve, reject) => {
          const transaction = this.db!.transaction([STORE_NAME], 'readonly');
          const store = transaction.objectStore(STORE_NAME);
          const request = store.get(key);

          request.onsuccess = () => {
            const result = request.result;
            if (result) {
              resolve(result.entry as CacheEntry<T>);
            } else {
              resolve(null);
            }
          };

          request.onerror = () => {
            reject(request.error || new Error('Erro ao ler do IndexedDB'));
          };
        });
      } catch (error) {
        console.warn('⚠️ [CacheStorage] Erro ao ler do IndexedDB, tentando localStorage:', error);
      }
    }

    // Fallback para localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const cached = localStorage.getItem(`cache_${key}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          return parsed.entry as CacheEntry<T>;
        }
      } catch (error) {
        console.warn('⚠️ [CacheStorage] Erro ao ler do localStorage:', error);
      }
    }

    return null;
  }

  /**
   * Salva uma entrada no cache
   */
  async set<T = any>(key: string, entry: CacheEntry<T>): Promise<void> {
    await this.init();

    const data = {
      key,
      entry,
      timestamp: Date.now(),
    };

    // Tentar IndexedDB primeiro
    if (this.db) {
      try {
        return new Promise((resolve, reject) => {
          const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
          const store = transaction.objectStore(STORE_NAME);
          const request = store.put(data);

          request.onsuccess = () => {
            resolve();
          };

          request.onerror = () => {
            reject(request.error || new Error('Erro ao salvar no IndexedDB'));
          };
        });
      } catch (error) {
        console.warn('⚠️ [CacheStorage] Erro ao salvar no IndexedDB, tentando localStorage:', error);
      }
    }

    // Fallback para localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(`cache_${key}`, JSON.stringify({ entry, timestamp: Date.now() }));
      } catch (error) {
        // Se localStorage estiver cheio, tentar limpar cache antigo
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
          console.warn('⚠️ [CacheStorage] localStorage cheio, limpando cache antigo...');
          this.cleanupOldEntries();
          try {
            localStorage.setItem(`cache_${key}`, JSON.stringify({ entry, timestamp: Date.now() }));
          } catch (retryError) {
            console.error('❌ [CacheStorage] Erro ao salvar no localStorage após limpeza:', retryError);
          }
        } else {
          console.error('❌ [CacheStorage] Erro ao salvar no localStorage:', error);
        }
      }
    }
  }

  /**
   * Remove uma entrada do cache
   */
  async delete(key: string): Promise<void> {
    await this.init();

    // Tentar IndexedDB primeiro
    if (this.db) {
      try {
        return new Promise((resolve, reject) => {
          const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
          const store = transaction.objectStore(STORE_NAME);
          const request = store.delete(key);

          request.onsuccess = () => {
            resolve();
          };

          request.onerror = () => {
            reject(request.error || new Error('Erro ao deletar do IndexedDB'));
          };
        });
      } catch (error) {
        console.warn('⚠️ [CacheStorage] Erro ao deletar do IndexedDB, tentando localStorage:', error);
      }
    }

    // Fallback para localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.removeItem(`cache_${key}`);
      } catch (error) {
        console.warn('⚠️ [CacheStorage] Erro ao deletar do localStorage:', error);
      }
    }
  }

  /**
   * Remove todas as entradas com uma tag específica
   */
  async deleteByTag(tag: string): Promise<number> {
    await this.init();
    let deleted = 0;

    // Tentar IndexedDB primeiro
    if (this.db) {
      try {
        return new Promise((resolve, reject) => {
          const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
          const store = transaction.objectStore(STORE_NAME);
          const index = store.index('tags');
          const request = index.openCursor(IDBKeyRange.only(tag));

          request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
              cursor.delete();
              deleted++;
              cursor.continue();
            } else {
              resolve(deleted);
            }
          };

          request.onerror = () => {
            reject(request.error || new Error('Erro ao deletar por tag do IndexedDB'));
          };
        });
      } catch (error) {
        console.warn('⚠️ [CacheStorage] Erro ao deletar por tag do IndexedDB:', error);
      }
    }

    // Fallback: iterar localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      const keysToDelete: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('cache_')) {
          try {
            const cached = localStorage.getItem(key);
            if (cached) {
              const parsed = JSON.parse(cached);
              if (parsed.entry?.tags?.includes(tag)) {
                keysToDelete.push(key);
              }
            }
          } catch {
            // Ignorar erros de parsing
          }
        }
      }
      keysToDelete.forEach(key => {
        localStorage.removeItem(key);
        deleted++;
      });
    }

    return deleted;
  }

  /**
   * Remove entradas antigas baseado em timestamp
   */
  async cleanupOldEntries(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    await this.init();
    const cutoff = Date.now() - maxAge;
    let deleted = 0;

    // Tentar IndexedDB primeiro
    if (this.db) {
      try {
        return new Promise((resolve, reject) => {
          const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
          const store = transaction.objectStore(STORE_NAME);
          const index = store.index('timestamp');
          const request = index.openCursor(IDBKeyRange.upperBound(cutoff));

          request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
              // Não deletar entradas estáticas
              if (cursor.value.entry?.strategy !== 'static') {
                cursor.delete();
                deleted++;
              }
              cursor.continue();
            } else {
              resolve(deleted);
            }
          };

          request.onerror = () => {
            reject(request.error || new Error('Erro ao limpar entradas antigas do IndexedDB'));
          };
        });
      } catch (error) {
        console.warn('⚠️ [CacheStorage] Erro ao limpar entradas antigas do IndexedDB:', error);
      }
    }

    // Fallback: iterar localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      const keysToDelete: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('cache_')) {
          try {
            const cached = localStorage.getItem(key);
            if (cached) {
              const parsed = JSON.parse(cached);
              if (parsed.timestamp < cutoff && parsed.entry?.strategy !== 'static') {
                keysToDelete.push(key);
              }
            }
          } catch {
            // Ignorar erros de parsing
          }
        }
      }
      keysToDelete.forEach(key => {
        localStorage.removeItem(key);
        deleted++;
      });
    }

    return deleted;
  }

  /**
   * Limpa todo o cache (exceto estático)
   */
  async clear(): Promise<void> {
    await this.init();

    // Tentar IndexedDB primeiro
    if (this.db) {
      try {
        return new Promise((resolve, reject) => {
          const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
          const store = transaction.objectStore(STORE_NAME);
          const request = store.openCursor();

          request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
              // Não deletar entradas estáticas
              if (cursor.value.entry?.strategy !== 'static') {
                cursor.delete();
              }
              cursor.continue();
            } else {
              resolve();
            }
          };

          request.onerror = () => {
            reject(request.error || new Error('Erro ao limpar IndexedDB'));
          };
        });
      } catch (error) {
        console.warn('⚠️ [CacheStorage] Erro ao limpar IndexedDB:', error);
      }
    }

    // Fallback: limpar localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      const keysToDelete: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('cache_')) {
          try {
            const cached = localStorage.getItem(key);
            if (cached) {
              const parsed = JSON.parse(cached);
              // Não deletar entradas estáticas
              if (parsed.entry?.strategy !== 'static') {
                keysToDelete.push(key);
              }
            }
          } catch {
            // Se não conseguir parsear, deletar
            keysToDelete.push(key);
          }
        }
      }
      keysToDelete.forEach(key => localStorage.removeItem(key));
    }
  }

  /**
   * Obtém todas as chaves do cache
   */
  async getAllKeys(): Promise<string[]> {
    await this.init();
    const keys: string[] = [];

    // Tentar IndexedDB primeiro
    if (this.db) {
      try {
        return new Promise((resolve, reject) => {
          const transaction = this.db!.transaction([STORE_NAME], 'readonly');
          const store = transaction.objectStore(STORE_NAME);
          const request = store.getAllKeys();

          request.onsuccess = () => {
            resolve(request.result as string[]);
          };

          request.onerror = () => {
            reject(request.error || new Error('Erro ao obter chaves do IndexedDB'));
          };
        });
      } catch (error) {
        console.warn('⚠️ [CacheStorage] Erro ao obter chaves do IndexedDB:', error);
      }
    }

    // Fallback: iterar localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('cache_')) {
          keys.push(key.replace('cache_', ''));
        }
      }
    }

    return keys;
  }
}

// Singleton
export const cacheStorage = new CacheStorage();











