// Re-exportar tipos e constantes dos módulos criados
export type { SalesData, SalesDataByDate, SalesCache } from './types';
export { MANUAL_ORDERS } from './constants';

// Re-exportar funções utilitárias
export {
  countOrdersPaginated,
  fetchRevenuePaginated,
  isHotmartOrder,
  getBrasiliaDate,
  createBrasiliaDate,
  processSalesDataForCharts,
  getCachedSalesData,
} from './utils';

// Re-exportar hooks do dashboard (já modularizados)
export {
  useDashboardStats,
  useSalesData,
  useSalesDataOptimized,
  useSunoCredits,
} from './dashboard';

// Re-exportar hooks de orders (modularizados)
export { useOrders, useOrdersStats } from './orders';

// Re-exportar hooks restantes do arquivo original (serão modularizados gradualmente)
export {
  useReleases,
  useReleaseMutation,
  useSongs,
  usePayments,
  useStaticData,
} from '../useAdminData.legacy';

