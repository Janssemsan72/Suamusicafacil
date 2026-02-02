/**
 * Sistema de Cache Robusto - Tipos e Interfaces
 * 
 * Estratégias de cache:
 * - STATIC: Dados que raramente mudam (planos, templates, configurações) - Cache infinito
 * - DYNAMIC: Dados que mudam periodicamente (pedidos, músicas, pagamentos) - Cache 5-10min
 * - REALTIME: Dados que mudam frequentemente (stats, créditos) - Cache 1-3min
 * - SESSION: Dados específicos da sessão (permissões, role) - Cache de sessão
 */

export type CacheStrategy = 'static' | 'dynamic' | 'realtime' | 'session';

export interface CacheConfig {
  /** Estratégia de cache */
  strategy: CacheStrategy;
  /** Tempo em ms que os dados são considerados válidos (staleTime) */
  staleTime: number;
  /** Tempo em ms que os dados permanecem em cache (gcTime) */
  gcTime: number;
  /** Se deve persistir no IndexedDB */
  persist?: boolean;
  /** Tags para invalidação em grupo */
  tags?: string[];
  /** Dependências - invalidar quando estas keys mudarem */
  dependencies?: string[];
  /** Se deve pré-carregar */
  preload?: boolean;
}

export interface CacheEntry<T = any> {
  /** Dados em cache */
  data: T;
  /** Timestamp de criação */
  timestamp: number;
  /** Timestamp de última atualização */
  updatedAt: number;
  /** Estratégia de cache */
  strategy: CacheStrategy;
  /** Tags para invalidação */
  tags?: string[];
  /** Versão do cache (para invalidação por versão) */
  version?: string;
  /** Metadata adicional */
  metadata?: Record<string, any>;
}

export interface CacheMetrics {
  /** Total de hits (cache encontrado) */
  hits: number;
  /** Total de misses (cache não encontrado) */
  misses: number;
  /** Total de sets (cache criado/atualizado) */
  sets: number;
  /** Total de invalidations (cache invalidado) */
  invalidations: number;
  /** Tamanho total do cache em bytes (estimado) */
  size: number;
}

export interface CacheStats {
  /** Métricas gerais */
  metrics: CacheMetrics;
  /** Número de entradas por estratégia */
  entriesByStrategy: Record<CacheStrategy, number>;
  /** Número de entradas por tag */
  entriesByTag: Record<string, number>;
  /** Timestamp da última limpeza */
  lastCleanup?: number;
}

/**
 * Configurações padrão por estratégia
 */
export const CACHE_STRATEGIES: Record<CacheStrategy, CacheConfig> = {
  static: {
    strategy: 'static',
    staleTime: Infinity, // Nunca fica stale
    gcTime: Infinity, // Nunca é removido
    persist: true,
    tags: ['static'],
    preload: true,
  },
  dynamic: {
    strategy: 'dynamic',
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 30 * 60 * 1000, // 30 minutos
    persist: true,
    tags: ['dynamic'],
    preload: false,
  },
  realtime: {
    strategy: 'realtime',
    staleTime: 1 * 60 * 1000, // 1 minuto
    gcTime: 10 * 60 * 1000, // 10 minutos
    persist: false, // Não persistir dados muito dinâmicos
    tags: ['realtime'],
    preload: false,
  },
  session: {
    strategy: 'session',
    staleTime: 30 * 60 * 1000, // 30 minutos
    gcTime: 60 * 60 * 1000, // 1 hora
    persist: true,
    tags: ['session'],
    preload: true,
  },
};

/**
 * Tags comuns para invalidação em grupo
 */
export const CACHE_TAGS = {
  // Dados estáticos
  STATIC: 'static',
  PRICING: 'pricing',
  TEMPLATES: 'templates',
  SETTINGS: 'settings',
  
  // Dados dinâmicos
  ORDERS: 'orders',
  SONGS: 'songs',
  PAYMENTS: 'payments',
  RELEASES: 'releases',
  LYRICS: 'lyrics',
  
  // Dados em tempo real
  DASHBOARD: 'dashboard',
  STATS: 'stats',
  CREDITS: 'credits',
  
  // Sessão
  SESSION: 'session',
  PERMISSIONS: 'permissions',
  USER: 'user',
} as const;











