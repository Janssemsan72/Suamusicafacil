import { supabase } from '@/integrations/supabase/client';
import { queryClient, queryKeys } from '@/lib/queryClient';
import type { SalesDataByDate, SalesData, SalesCache } from './types';
import { MANUAL_ORDERS } from './constants';

export const isHotmartOrder = (o: any) =>
  o?.payment_provider === 'hotmart' ||
  o?.provider === 'hotmart' ||
  (!o?.payment_provider && !o?.provider);

/**
 * Função auxiliar para contar pedidos via paginação (suporta milhões de registros)
 * Se count exact falhar, conta manualmente via paginação
 * Trata graciosamente quando campos não existem
 */
export async function countOrdersPaginated(filters?: {
  status?: string;
  plan?: string;
  provider?: 'hotmart';
}): Promise<number> {
  try {
    // Primeiro tentar count exact
    let query = supabase.from("orders").select("id", { count: 'exact', head: true });
    
    if (filters?.status) {
      query = query.eq("status", filters.status);
    }
    
    const { count, error } = await query;
    
    // Tratar erros de tabela não encontrada ou permissão
    if (error) {
      const isTableError = error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('relation');
      const isPermissionError = error.code === '42501' || error.message?.includes('permission');
      
      if (isTableError || isPermissionError) {
        return 0;
      }
    }
    
    // Se count exact funcionou e retornou um valor, usar ele
    if (!error && count !== null && count > 0) {
      return count;
    }
    
    // Se count exact falhou ou retornou 0/null, contar manualmente via paginação
    let totalCount = 0;
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;
    let fieldsToSelect = "id";
    try {
      const testQuery = supabase.from("orders").select("id, payment_provider, provider").limit(1);
      const { error: testError } = await testQuery;
      if (!testError || (testError.code !== '400' && !testError.message?.includes('column'))) {
        fieldsToSelect = "id, payment_provider, provider";
      }
    } catch (e) {
      fieldsToSelect = "id";
    }

    while (hasMore) {
      let countQuery = supabase.from("orders").select(fieldsToSelect);
      
      if (filters?.status) {
        countQuery = countQuery.eq("status", filters.status);
      }
      
      if (filters?.plan) {
        countQuery = countQuery.eq("plan", filters.plan);
      }
      
      const { data, error: dataError } = await countQuery.range(from, from + pageSize - 1);
      
      if (dataError) {
        const isTableError = dataError.code === '42P01' || dataError.message?.includes('does not exist') || dataError.message?.includes('relation');
        const isPermissionError = dataError.code === '42501' || dataError.message?.includes('permission');
        const isColumnError = dataError.code === '400' && (dataError.message?.includes('column') || dataError.message?.includes('PGRST'));
        
        if (isTableError || isPermissionError) {
          return totalCount; // Retornar o que já foi contado
        }
        
        if (isColumnError && fieldsToSelect.includes('payment_provider')) {
          // Tentar novamente sem campos de provider
          fieldsToSelect = "id";
          continue;
        }
        
        hasMore = false;
        break;
      }
      
      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        const canFilterByProvider = filters?.provider === 'hotmart' && fieldsToSelect.includes('payment_provider');
        const count = canFilterByProvider ? data.filter(isHotmartOrder).length : data.length;
        totalCount += count;
        from += pageSize;
        hasMore = data.length === pageSize;
      }
    }
    
    return totalCount;
  } catch (err: any) {
    // Tratar qualquer erro inesperado
    const isTableError = err?.code === '42P01' || err?.message?.includes('does not exist') || err?.message?.includes('relation');
    const isPermissionError = err?.code === '42501' || err?.message?.includes('permission');
    
    if (isTableError || isPermissionError) {
      return 0;
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.warn('Erro ao contar pedidos:', err);
    }
    return 0;
  }
}

/**
 * Função auxiliar para buscar receita via paginação (suporta milhões de registros)
 * Trata graciosamente quando campos não existem
 */
export async function fetchRevenuePaginated(filters?: {
  plan?: string;
  provider?: 'hotmart';
}): Promise<number> {
  let totalRevenue = 0;
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;
  let fieldsToSelect = "id"; // Começar com campos mínimos

  try {
    // Primeiro, tentar detectar quais campos existem
    try {
      const testQuery = supabase
        .from("orders")
        .select("id, amount_cents, payment_provider, provider")
        .eq("status", "paid")
        .limit(1);
      
      const { error: testError } = await testQuery;
      
      if (!testError || (testError.code !== '400' && !testError.message?.includes('column'))) {
        fieldsToSelect = "id, amount_cents, payment_provider, provider";
      } else {
        // Tentar sem amount_cents
        const testQuery2 = supabase
          .from("orders")
          .select("id, payment_provider, provider")
          .eq("status", "paid")
          .limit(1);
        
        const { error: testError2 } = await testQuery2;
        
        if (!testError2 || (testError2.code !== '400' && !testError2.message?.includes('column'))) {
          fieldsToSelect = "id, payment_provider, provider";
        } else {
          // Usar apenas id se nada funcionar
          fieldsToSelect = "id";
        }
      }
    } catch (e) {
      // Se falhar, usar apenas id
      fieldsToSelect = "id";
    }

    while (hasMore) {
      let query = supabase
        .from("orders")
        .select(fieldsToSelect)
        .eq("status", "paid");

      if (filters?.plan) {
        query = query.eq('plan', filters.plan);
      }

      const { data, error } = await query.range(from, from + pageSize - 1);
      
      if (error) {
        const isTableError = error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('relation');
        const isPermissionError = error.code === '42501' || error.message?.includes('permission');
        const isColumnError = error.code === '400' && (error.message?.includes('column') || error.message?.includes('PGRST'));
        
        if (isTableError || isPermissionError) {
          return 0;
        }
        
        if (isColumnError) {
          // Tentar com campos mais simples
          if (fieldsToSelect.includes('amount_cents')) {
            fieldsToSelect = fieldsToSelect.replace('amount_cents, ', '').replace(', amount_cents', '');
            continue;
          }
          if (fieldsToSelect.includes('payment_provider')) {
            fieldsToSelect = "id";
            continue;
          }
          return 0;
        }
        
        if (process.env.NODE_ENV === 'development') {
          console.warn('Erro ao buscar receita via paginação:', error);
        }
        break;
      }
    
      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        const canFilterByProvider = filters?.provider === 'hotmart' && fieldsToSelect.includes('payment_provider');
        const filteredData = canFilterByProvider ? data.filter(isHotmartOrder) : data;
        if (fieldsToSelect.includes('amount_cents')) {
          const pageRevenue = filteredData.reduce((sum: number, o: any) => {
            const amount = o.amount_cents || 0;
            return sum + (typeof amount === 'number' && !isNaN(amount) ? amount : 0);
          }, 0);
          
          totalRevenue += pageRevenue;
        } else {
          // Se amount_cents não existe, retornar 0
          // (não podemos calcular receita sem esse campo)
          return 0;
        }
        
        from += pageSize;
        hasMore = data.length === pageSize;
      }
    }
  } catch (err: any) {
    const isTableError = err?.code === '42P01' || err?.message?.includes('does not exist') || err?.message?.includes('relation');
    const isPermissionError = err?.code === '42501' || err?.message?.includes('permission');
    
    if (isTableError || isPermissionError) {
      return 0;
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.warn('Erro inesperado ao buscar receita:', err);
    }
    return 0;
  }
  
  return totalRevenue / 100; // Converter centavos para reais
}

/**
 * Obtém a data atual no horário de Brasília
 */
export function getBrasiliaDate(): { year: number; month: number; day: number; date: Date } {
  const now = new Date();
  const brasiliaDateStr = now.toLocaleString('en-US', { 
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const [monthStr, dayStr, yearStr] = brasiliaDateStr.split('/');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  
  const date = new Date(Date.UTC(year, month - 1, day, 3, 0, 0, 0));
  
  return { year, month, day, date };
}

/**
 * Cria uma data no horário de Brasília
 */
export function createBrasiliaDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 3, 0, 0, 0));
}

/**
 * Processa dados agregados de vendas e formata para gráficos
 */
export function processSalesDataForCharts(
  aggregatedData: Record<string, SalesDataByDate>,
  period: '7d' | '30d' | '90d' | 'month' | 'all',
  selectedMonth?: string
): SalesData[] {
  const { year, month, day, date: todayBrasiliaUTC } = getBrasiliaDate();
  
  // Filtrar dados por período
  let filteredEntries = Object.entries(aggregatedData);
  let groupByMonth = false;
  
  if (period === '30d') {
    let startYear = year;
    if (month < 11 || (month === 11 && day < 3)) {
      startYear = year - 1;
    }
    const startDate = createBrasiliaDate(startYear, 11, 3);
    
    filteredEntries = filteredEntries.filter(([dateKey]) => {
      const [y, m, d] = dateKey.split('-').map(Number);
      const date = createBrasiliaDate(y, m, d);
      return date >= startDate && date <= todayBrasiliaUTC;
    });
  } else if (period === '7d') {
    const sevenDaysAgo = new Date(todayBrasiliaUTC);
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);
    
    filteredEntries = filteredEntries.filter(([dateKey]) => {
      const [y, m, d] = dateKey.split('-').map(Number);
      const date = createBrasiliaDate(y, m, d);
      return date >= sevenDaysAgo && date <= todayBrasiliaUTC;
    });
  } else if (period === '90d') {
    const ninetyDaysAgo = new Date(todayBrasiliaUTC);
    ninetyDaysAgo.setUTCDate(ninetyDaysAgo.getUTCDate() - 89);
    
    filteredEntries = filteredEntries.filter(([dateKey]) => {
      const [y, m, d] = dateKey.split('-').map(Number);
      const date = createBrasiliaDate(y, m, d);
      return date >= ninetyDaysAgo && date <= todayBrasiliaUTC;
    });
  } else if (period === 'month') {
    groupByMonth = true;
    if (selectedMonth) {
      const [selectedYear, selectedMonthNum] = selectedMonth.split('-').map(Number);
      filteredEntries = filteredEntries.filter(([dateKey]) => {
        const [y, m] = dateKey.split('-').map(Number);
        return y === selectedYear && m === selectedMonthNum;
      });
    } else {
      filteredEntries = filteredEntries.filter(([dateKey]) => {
        const [y, m] = dateKey.split('-').map(Number);
        return y === year && m === month;
      });
    }
  }
  
  // Converter para array formatado
  const salesArray: SalesData[] = filteredEntries
    .filter(([_, values]) => values.count > 0)
    .map(([dateKey, values]): SalesData => {
      if (groupByMonth) {
        const [y, m] = dateKey.split('-').map(Number);
        const monthName = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short' });
        const dateDisplay = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)}/${y}`;
        
        return {
          date: dateDisplay,
          dateKey: dateKey,
          fullDate: dateDisplay,
          revenue: values.revenue,
          count: values.count,
          totalCount: values.count,
        };
      } else {
        const [y, m, d] = dateKey.split('-').map(Number);
        const dateObj = new Date(Date.UTC(y, m - 1, d));
        const dateDisplay = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
        const fullDate = dateObj.toLocaleDateString('pt-BR', { 
          day: '2-digit', 
          month: 'short',
          timeZone: 'UTC'
        });
        
        return {
          date: dateDisplay,
          dateKey: dateKey,
          fullDate: fullDate,
          revenue: values.revenue,
          count: values.count,
          totalCount: values.count,
        };
      }
    })
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  
  // Preencher dias faltantes para período 30d
  if (period === '30d' && !groupByMonth) {
    let startYear = year;
    if (month < 11 || (month === 11 && day < 3)) {
      startYear = year - 1;
    }
    const startDate = createBrasiliaDate(startYear, 11, 3);
    
    const completeArray: SalesData[] = [];
    const existingDataMap = new Map(salesArray.map(d => [d.dateKey, d]));
    
    const diffTime = todayBrasiliaUTC.getTime() - startDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    for (let i = 0; i < diffDays; i++) {
      const date = new Date(startDate);
      date.setUTCDate(date.getUTCDate() + i);
      
      const dateInBrasilia = date.toLocaleString('en-US', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const [monthStr, dayStr, yearStr] = dateInBrasilia.split('/');
      const yearNum = parseInt(yearStr, 10);
      const monthNum = parseInt(monthStr, 10);
      const dayNum = parseInt(dayStr, 10);
      const dateKey = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      
      if (existingDataMap.has(dateKey)) {
        completeArray.push(existingDataMap.get(dateKey)!);
      } else {
        const dateObj = new Date(Date.UTC(yearNum, monthNum - 1, dayNum));
        const dateDisplay = `${String(dayNum).padStart(2, '0')}/${String(monthNum).padStart(2, '0')}`;
        const fullDate = dateObj.toLocaleDateString('pt-BR', { 
          day: '2-digit', 
          month: 'short',
          timeZone: 'UTC'
        });
        
        completeArray.push({
          date: dateDisplay,
          dateKey: dateKey,
          fullDate: fullDate,
          revenue: 0,
          count: 0,
          totalCount: 0,
        });
      }
    }
    
    return completeArray.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }
  
  return salesArray;
}

/**
 * Função auxiliar para ler cache sincronamente
 */
export function getCachedSalesData(): Record<string, SalesDataByDate> | null {
  if (typeof window === 'undefined') return null;
  
  const today = new Date();
  const todayKey = today.toISOString().split('T')[0];
  const cacheKey = 'sales_data_cache_v1';
  
  try {
    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData) {
      const parsed: SalesCache = JSON.parse(cachedData);
      
      if (parsed && parsed.lastUpdate && parsed.data) {
        if (parsed.lastUpdate === todayKey) {
          const ninetyDaysAgo = new Date(today);
          ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
          
          const cleanedData: Record<string, SalesDataByDate> = {};
          Object.entries(parsed.data).forEach(([dateKey, values]) => {
            const date = new Date(dateKey);
            if (date >= ninetyDaysAgo) {
              const raw: any = values;
              const revenue =
                typeof raw?.revenue === 'number'
                  ? raw.revenue
                  : (typeof raw?.hotmart === 'number' ? raw.hotmart : 0);
              const count = typeof raw?.count === 'number' ? raw.count : 0;
              cleanedData[dateKey] = { revenue, count };
            }
          });
          
          return cleanedData;
        }
      }
    }
  } catch (e) {
    console.error('Erro ao ler cache de vendas:', e);
  }
  
  return null;
}

// Exportar MANUAL_ORDERS para uso nos hooks
export { MANUAL_ORDERS };

