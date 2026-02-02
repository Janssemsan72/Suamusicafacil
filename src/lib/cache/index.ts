/**
 * Sistema de Cache Robusto - Exportações Principais
 * 
 * Exporta todas as funcionalidades do sistema de cache
 * para uso fácil em toda a aplicação
 */

export { cacheManager } from './manager';
export { cacheStorage } from './storage';
export { useCache, useCacheInvalidation, useCacheStats, useCachePreload } from './hooks';
export { CACHE_TAGS, CACHE_STRATEGIES } from './types';
export type { CacheConfig, CacheEntry, CacheStrategy, CacheMetrics, CacheStats } from './types';











