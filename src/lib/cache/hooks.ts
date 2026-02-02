/**
 * Sistema de Cache Robusto - Hooks React
 * 
 * Hooks para usar o sistema de cache de forma reativa
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cacheManager } from './manager';
import type { CacheConfig } from './types';
import { CACHE_STRATEGIES } from './types';

/**
 * Hook para usar cache com React Query
 */
export function useCache<T = any>(
  key: string | string[],
  fetcher: () => Promise<T>,
  config?: Partial<CacheConfig>
) {
  const queryKey = Array.isArray(key) ? key : [key];
  const strategy = config?.strategy || 'dynamic';
  const cacheConfig = { ...CACHE_STRATEGIES[strategy], ...config };
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      // Tentar cache primeiro
      const cached = await cacheManager.get<T>(queryKey.join(':'), cacheConfig);
      if (cached !== null) {
        return cached;
      }

      // Buscar dados
      const data = await fetcher();
      
      // Salvar no cache
      await cacheManager.set(queryKey.join(':'), data, cacheConfig);
      
      return data;
    },
    staleTime: cacheConfig.staleTime,
    gcTime: cacheConfig.gcTime,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Pré-carregar se configurado
  useEffect(() => {
    if (cacheConfig.preload && !query.data) {
      cacheManager.preload(queryKey.join(':'), fetcher, cacheConfig);
    }
  }, [cacheConfig.preload, queryKey.join(':')]);

  return query;
}

/**
 * Hook para invalidar cache
 */
export function useCacheInvalidation() {
  const queryClient = useQueryClient();

  const invalidate = useCallback(async (key: string | string[]) => {
    const cacheKey = Array.isArray(key) ? key.join(':') : key;
    await cacheManager.delete(cacheKey);
    
    if (queryClient) {
      queryClient.invalidateQueries({ queryKey: Array.isArray(key) ? key : [key] });
    }
  }, [queryClient]);

  const invalidateByTag = useCallback(async (tag: string) => {
    await cacheManager.invalidateByTag(tag);
    
    if (queryClient) {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = query.queryKey[0] as string;
          return queryKey.includes(tag);
        },
      });
    }
  }, [queryClient]);

  const invalidateByTags = useCallback(async (tags: string[]) => {
    await cacheManager.invalidateByTags(tags);
    
    if (queryClient) {
      tags.forEach(tag => {
        queryClient.invalidateQueries({
          predicate: (query) => {
            const queryKey = query.queryKey[0] as string;
            return queryKey.includes(tag);
          },
        });
      });
    }
  }, [queryClient]);

  return {
    invalidate,
    invalidateByTag,
    invalidateByTags,
  };
}

/**
 * Hook para obter estatísticas do cache
 */
export function useCacheStats() {
  const [stats, setStats] = useState(cacheManager.getStats());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Atualizar stats a cada 5 segundos
    intervalRef.current = setInterval(() => {
      setStats(cacheManager.getStats());
    }, 5000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return stats;
}

/**
 * Hook para pré-carregar dados
 */
export function useCachePreload<T = any>(
  key: string | string[],
  fetcher: () => Promise<T>,
  config?: Partial<CacheConfig>
) {
  const cacheKey = Array.isArray(key) ? key.join(':') : key;
  const strategy = config?.strategy || 'dynamic';
  const cacheConfig = { ...CACHE_STRATEGIES[strategy], ...config };

  useEffect(() => {
    cacheManager.preload(cacheKey, fetcher, cacheConfig);
  }, [cacheKey]);
}

