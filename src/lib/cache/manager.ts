/**
 * Sistema de Cache Robusto - Gerenciador Centralizado
 * 
 * Gerencia cache em memória + persistência com IndexedDB
 * Integra com React Query para cache unificado
 */

import { QueryClient } from '@tanstack/react-query';
import { cacheStorage } from './storage';
import type { CacheEntry, CacheConfig, CacheStrategy, CacheMetrics, CacheStats } from './types';
import { CACHE_STRATEGIES, CACHE_TAGS } from './types';

class CacheManager {
  private memoryCache = new Map<string, CacheEntry>();
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    sets: 0,
    invalidations: 0,
    size: 0,
  };
  private queryClient: QueryClient | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  /**
   * Inicializa o gerenciador de cache
   */
  async init(queryClient: QueryClient): Promise<void> {
    this.queryClient = queryClient;
    await cacheStorage.init();
    
    // Limpeza automática a cada hora
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 60 * 1000);

    // Limpeza inicial
    this.cleanup();
  }

  /**
   * Obtém dados do cache
   */
  async get<T = any>(key: string, config?: Partial<CacheConfig>): Promise<T | null> {
    const strategy = config?.strategy || 'dynamic';
    const cacheConfig = { ...CACHE_STRATEGIES[strategy], ...config };

    // 1. Tentar memória primeiro (mais rápido)
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry) {
      const age = Date.now() - memoryEntry.updatedAt;
      if (age < cacheConfig.staleTime) {
        this.metrics.hits++;
        return memoryEntry.data as T;
      }
      // Cache stale, mas ainda válido para exibição
      if (age < cacheConfig.gcTime) {
        this.metrics.hits++;
        // Retornar dados stale mas marcar para refetch em background
        this.refetchInBackground(key);
        return memoryEntry.data as T;
      }
      // Cache expirado, remover
      this.memoryCache.delete(key);
    }

    // 2. Tentar storage persistente
    if (cacheConfig.persist) {
      const storageEntry = await cacheStorage.get<T>(key);
      if (storageEntry) {
        const age = Date.now() - storageEntry.updatedAt;
        if (age < cacheConfig.staleTime) {
          // Restaurar para memória
          this.memoryCache.set(key, storageEntry);
          this.metrics.hits++;
          return storageEntry.data as T;
        }
        // Cache stale
        if (age < cacheConfig.gcTime) {
          this.memoryCache.set(key, storageEntry);
          this.metrics.hits++;
          this.refetchInBackground(key);
          return storageEntry.data as T;
        }
        // Cache expirado
        await cacheStorage.delete(key);
      }
    }

    // 3. Tentar React Query cache
    if (this.queryClient) {
      const queryData = this.queryClient.getQueryData<T>([key]);
      if (queryData) {
        this.metrics.hits++;
        // Salvar no cache próprio também
        await this.set<T>(key, queryData as T, cacheConfig);
        return queryData as T;
      }
    }

    this.metrics.misses++;
    return null;
  }

  /**
   * Salva dados no cache
   */
  async set<T = any>(key: string, data: T, config?: Partial<CacheConfig>): Promise<void> {
    const strategy = config?.strategy || 'dynamic';
    const cacheConfig = { ...CACHE_STRATEGIES[strategy], ...config };

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      updatedAt: Date.now(),
      strategy,
      tags: cacheConfig.tags,
      metadata: {
        staleTime: cacheConfig.staleTime,
        gcTime: cacheConfig.gcTime,
      },
    };

    // Salvar em memória
    this.memoryCache.set(key, entry);
    this.metrics.sets++;
    this.updateSize();

    // Salvar em storage persistente se configurado
    if (cacheConfig.persist) {
      await cacheStorage.set(key, entry);
    }

    // Salvar no React Query também
    if (this.queryClient) {
      this.queryClient.setQueryData([key], data);
    }
  }

  /**
   * Remove uma entrada do cache
   */
  async delete(key: string): Promise<void> {
    this.memoryCache.delete(key);
    await cacheStorage.delete(key);
    
    if (this.queryClient) {
      this.queryClient.removeQueries({ queryKey: [key] });
    }

    this.metrics.invalidations++;
    this.updateSize();
  }

  /**
   * Invalida cache por tag
   */
  async invalidateByTag(tag: string): Promise<number> {
    let invalidated = 0;

    // Invalidar em memória
    const keysToDelete: string[] = [];
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.tags?.includes(tag)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => {
      this.memoryCache.delete(key);
      invalidated++;
    });

    // Invalidar em storage
    const storageDeleted = await cacheStorage.deleteByTag(tag);
    invalidated += storageDeleted;

    // Invalidar no React Query
    if (this.queryClient) {
      this.queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = query.queryKey[0] as string;
          // Verificar se a key contém a tag (heurística simples)
          return queryKey.includes(tag);
        },
      });
    }

    this.metrics.invalidations += invalidated;
    this.updateSize();

    return invalidated;
  }

  /**
   * Invalida cache por múltiplas tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    let totalInvalidated = 0;
    for (const tag of tags) {
      totalInvalidated += await this.invalidateByTag(tag);
    }
    return totalInvalidated;
  }

  /**
   * Pré-carrega dados no cache
   */
  async preload<T = any>(
    key: string,
    fetcher: () => Promise<T>,
    config?: Partial<CacheConfig>
  ): Promise<T> {
    // Verificar se já existe
    const cached = await this.get<T>(key, config);
    if (cached !== null) {
      return cached;
    }

    // Buscar e cachear
    const data = await fetcher();
    await this.set(key, data, config);
    return data;
  }

  /**
   * Refetch em background para dados stale
   */
  private refetchInBackground(key: string): void {
    if (this.queryClient) {
      // Invalidar query para forçar refetch em background
      this.queryClient.invalidateQueries({ queryKey: [key] }, { cancelRefetch: false });
    }
  }

  /**
   * Limpeza automática de cache expirado
   */
  async cleanup(): Promise<void> {
    const now = Date.now();
    const keysToDelete: string[] = [];

    // Limpar memória
    for (const [key, entry] of this.memoryCache.entries()) {
      const config = CACHE_STRATEGIES[entry.strategy];
      const age = now - entry.updatedAt;
      
      // Não limpar entradas estáticas
      if (entry.strategy === 'static') {
        continue;
      }

      // Remover se expirado
      if (age > config.gcTime) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.memoryCache.delete(key));

    // Limpar storage (últimos 7 dias)
    await cacheStorage.cleanupOldEntries(7 * 24 * 60 * 60 * 1000);

    this.updateSize();
  }

  /**
   * Obtém estatísticas do cache
   */
  getStats(): CacheStats {
    const entriesByStrategy: Record<CacheStrategy, number> = {
      static: 0,
      dynamic: 0,
      realtime: 0,
      session: 0,
    };

    const entriesByTag: Record<string, number> = {};

    for (const entry of this.memoryCache.values()) {
      entriesByStrategy[entry.strategy]++;
      if (entry.tags) {
        for (const tag of entry.tags) {
          entriesByTag[tag] = (entriesByTag[tag] || 0) + 1;
        }
      }
    }

    return {
      metrics: { ...this.metrics },
      entriesByStrategy,
      entriesByTag,
    };
  }

  /**
   * Limpa todo o cache (exceto estático)
   */
  async clear(): Promise<void> {
    // Limpar memória (exceto estático)
    const keysToDelete: string[] = [];
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.strategy !== 'static') {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.memoryCache.delete(key));

    // Limpar storage
    await cacheStorage.clear();

    // Limpar React Query (exceto estático)
    if (this.queryClient) {
      this.queryClient.invalidateQueries({
        predicate: (query) => {
          // Heurística: não invalidar queries que parecem estáticas
          const key = query.queryKey[0] as string;
          return !key.includes('static') && !key.includes('pricing') && !key.includes('templates');
        },
      });
    }

    this.updateSize();
  }

  /**
   * Atualiza estimativa de tamanho do cache
   */
  private updateSize(): void {
    let size = 0;
    for (const entry of this.memoryCache.values()) {
      try {
        size += JSON.stringify(entry).length * 2; // Estimativa: 2 bytes por char
      } catch {
        // Ignorar erros de serialização
      }
    }
    this.metrics.size = size;
  }

  /**
   * Reseta métricas
   */
  resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      invalidations: 0,
      size: 0,
    };
  }

  /**
   * Destrói o gerenciador
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.memoryCache.clear();
    this.queryClient = null;
  }
}

// Singleton
export const cacheManager = new CacheManager();

// Exportar tags para uso externo
export { CACHE_TAGS };











