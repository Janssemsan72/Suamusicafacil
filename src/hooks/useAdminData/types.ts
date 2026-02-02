/**
 * Interface para dados agregados de vendas por dia
 */
export interface SalesDataByDate {
  revenue: number;
  count: number;
}

/**
 * Interface para dados de vendas formatados para gráficos
 */
export interface SalesData {
  date: string;
  dateKey: string;
  fullDate?: string;
  revenue: number;
  count: number;
  totalCount: number;
}

/**
 * Interface para cache de vendas
 */
export interface SalesCache {
  lastUpdate: string; // "YYYY-MM-DD"
  data: Record<string, SalesDataByDate>;
}

