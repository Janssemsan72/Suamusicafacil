import { QueryClient } from '@tanstack/react-query';

/**
 * Configuração do React Query para área administrativa
 * 
 * ✅ OTIMIZAÇÃO DE PERFORMANCE:
 * - Cache aumentado para 10 minutos (dados ficam em memória por mais tempo)
 * - Stale time de 3 minutos (dados são considerados válidos por 3min - reduz requisições)
 * - RefetchOnWindowFocus desabilitado (evita requisições ao alternar abas)
 * - RefetchOnMount desabilitado (usa cache quando disponível)
 * - Retry reduzido para 1 (falhas rápidas)
 * - ✅ NOVO: Integrado com sistema de cache robusto (IndexedDB + memória)
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // ✅ OTIMIZAÇÃO: Cache aumentado para 10 minutos
      gcTime: 10 * 60 * 1000,
      
      // ✅ OTIMIZAÇÃO: Stale time aumentado para 3 minutos (reduz requisições)
      staleTime: 3 * 60 * 1000,
      
      // ✅ OTIMIZAÇÃO: Desabilitado para evitar requisições ao alternar abas
      refetchOnWindowFocus: false,
      
      // ✅ OTIMIZAÇÃO: Desabilitado - admin não precisa refetch automático ao reconectar
      refetchOnReconnect: false,
      
      // ✅ OTIMIZAÇÃO: Não refetch automaticamente ao montar (usa cache)
      refetchOnMount: false,
      
      // ✅ OTIMIZAÇÃO: Retry reduzido para 1 (falhas mais rápidas)
      retry: 1,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      
      // Network mode
      networkMode: 'online',
    },
    mutations: {
      // Retry mutations apenas 1 vez
      retry: 1,
      
      // Network mode
      networkMode: 'online',
    },
  },
});

/**
 * Query keys organizados por feature
 */
export const queryKeys = {
  // Dashboard
  dashboard: {
    all: ['dashboard'] as const,
    stats: () => [...queryKeys.dashboard.all, 'stats'] as const,
    salesData: (period: string, month?: string) => 
      [...queryKeys.dashboard.all, 'sales', period, month] as const,
    pieData: (period: string, month?: string) => 
      [...queryKeys.dashboard.all, 'pie', period, month] as const,
    jobs: () => [...queryKeys.dashboard.all, 'jobs'] as const,
    songs: () => [...queryKeys.dashboard.all, 'songs'] as const,
    sunoCredits: () => [...queryKeys.dashboard.all, 'suno-credits'] as const,
  },
  
  // Orders
  orders: {
    all: ['orders'] as const,
    list: (filters?: any) => [...queryKeys.orders.all, 'list', filters] as const,
    detail: (id: string) => [...queryKeys.orders.all, 'detail', id] as const,
    count: () => [...queryKeys.orders.all, 'count'] as const,
    stats: (filters?: any) => [...queryKeys.orders.all, 'stats', filters] as const,
  },
  
  // Releases
  releases: {
    all: ['releases'] as const,
    list: () => [...queryKeys.releases.all, 'list'] as const,
  },
  
  // Songs
  songs: {
    all: ['songs'] as const,
    list: (filters?: any) => [...queryKeys.songs.all, 'list', filters] as const,
    detail: (id: string) => [...queryKeys.songs.all, 'detail', id] as const,
  },
  
  // Payments
  payments: {
    all: ['payments'] as const,
    list: (filters?: any) => [...queryKeys.payments.all, 'list', filters] as const,
  },
  
  // Static data (cache infinito)
  static: {
    all: ['static'] as const,
    pricing: () => [...queryKeys.static.all, 'pricing'] as const,
    emailTemplates: () => [...queryKeys.static.all, 'email-templates'] as const,
    settings: () => [...queryKeys.static.all, 'settings'] as const,
  },
};

/**
 * Utilitário para invalidar cache de forma inteligente
 * ✅ NOVO: Integrado com sistema de cache robusto
 */
export const invalidateQueries = {
  dashboard: async () => {
    const { cacheManager } = await import('./cache/manager');
    await cacheManager.invalidateByTag('dashboard');
    await cacheManager.invalidateByTag('stats');
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
  },
  orders: async () => {
    const { cacheManager } = await import('./cache/manager');
    await cacheManager.invalidateByTag('orders');
    queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
  },
  releases: async () => {
    const { cacheManager } = await import('./cache/manager');
    await cacheManager.invalidateByTag('releases');
    queryClient.invalidateQueries({ queryKey: queryKeys.releases.all });
  },
  songs: async () => {
    const { cacheManager } = await import('./cache/manager');
    await cacheManager.invalidateByTag('songs');
    queryClient.invalidateQueries({ queryKey: queryKeys.songs.all });
  },
  payments: async () => {
    const { cacheManager } = await import('./cache/manager');
    await cacheManager.invalidateByTag('payments');
    queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
  },
  lyrics: async () => {
    const { cacheManager } = await import('./cache/manager');
    await cacheManager.invalidateByTag('lyrics');
    queryClient.invalidateQueries({ queryKey: ['lyrics-approvals'] });
  },
  all: async () => {
    const { cacheManager } = await import('./cache/manager');
    await cacheManager.clear();
    queryClient.invalidateQueries();
  },
};

/**
 * Inicializa o sistema de cache robusto
 * Deve ser chamado após criar o queryClient
 */
export async function initCacheSystem(): Promise<void> {
  const isAdminRoute =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');
  if (!isAdminRoute) return;
  const { cacheManager } = await import('./cache/manager');
  await cacheManager.init(queryClient);
  console.log('✅ [Cache] Sistema de cache robusto inicializado');
}




