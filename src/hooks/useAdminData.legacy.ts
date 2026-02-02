import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys, queryClient } from '@/lib/queryClient';
import { toast } from 'sonner';
import { sendReleaseWebhook } from '@/utils/webhook';

const isHotmartOrder = (o: any) =>
  o?.payment_provider === 'hotmart' ||
  o?.provider === 'hotmart' ||
  (!o?.payment_provider && !o?.provider);

/**
 * Função auxiliar para contar pedidos via paginação (suporta milhões de registros)
 * Se count exact falhar, conta manualmente via paginação
 */
async function countOrdersPaginated(filters?: {
  status?: string;
  provider?: 'hotmart';
  plan?: string;
}): Promise<number> {
  // Primeiro tentar count exact
  let query = supabase.from("orders").select("id", { count: 'exact', head: true });
  
  if (filters?.status) {
    query = query.eq("status", filters.status);
  }
  
  // ✅ CORREÇÃO: Não usar .or() aqui - será filtrado no código abaixo se necessário
  // O Supabase não aceita .or() quando há outros filtros aplicados
  
  const { count, error } = await query;
  
  // Se count exact funcionou e retornou um valor, usar ele
  // Se há filtro de provider, precisamos filtrar no código
  if (!error && count !== null && count > 0) {
    if (!filters?.provider) {
      return count;
    }
  }
  
  // Se count exact falhou ou retornou 0/null, contar manualmente via paginação
  
  let totalCount = 0;
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    let countQuery = supabase.from("orders").select("id, payment_provider, provider");
    
    if (filters?.status) {
      countQuery = countQuery.eq("status", filters.status);
    }
    
    if (filters?.plan) {
      countQuery = countQuery.eq("plan", filters.plan);
    }
    
    // ✅ CORREÇÃO: Não usar .or() aqui - filtrar no código abaixo
    // O Supabase não aceita .or() quando há outros filtros aplicados
    
    const { data, error: dataError } = await countQuery.range(from, from + pageSize - 1);
    
    if (dataError || !data || data.length === 0) {
      hasMore = false;
    } else {
      if (filters?.provider === 'hotmart') {
        const filtered = data.filter(isHotmartOrder);
        totalCount += filtered.length;
      } else {
        totalCount += data.length;
      }
      from += pageSize;
      hasMore = data.length === pageSize;
      
    }
  }
  
  return totalCount;
}

/**
 * Função auxiliar para buscar receita via paginação (suporta milhões de registros)
 */
async function fetchRevenuePaginated(filters?: {
  provider?: 'hotmart';
}): Promise<number> {
  let totalRevenue = 0;
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;

  try {
    while (hasMore) {
      // ✅ CORREÇÃO: Tentar buscar com amount_cents primeiro
      let { data, error } = await supabase
        .from("orders")
        .select("amount_cents, payment_provider, provider")
        .eq("status", "paid")
        .range(from, from + pageSize - 1);
      
      // ✅ CORREÇÃO: Se erro 400 por campo não existir, tentar sem amount_cents
      if (error && error.code === '400' && (error.message?.includes('amount_cents') || error.message?.includes('column'))) {
        // Campo amount_cents não existe, buscar sem ele e retornar 0 (não podemos calcular)
        const { data: dataWithoutAmount, error: errorWithoutAmount } = await supabase
          .from("orders")
          .select("id, payment_provider, provider")
          .eq("status", "paid")
          .range(from, from + pageSize - 1);
        
        if (errorWithoutAmount) {
          const isTableError = errorWithoutAmount.code === '42P01' || errorWithoutAmount.message?.includes('does not exist');
          const isPermissionError = errorWithoutAmount.code === '42501' || errorWithoutAmount.message?.includes('permission');
          
          if (isTableError || isPermissionError) {
            return 0;
          }
          
          console.warn('Erro ao buscar receita (sem amount_cents):', errorWithoutAmount);
          break;
        }
        
        // Se não tem amount_cents, não podemos calcular receita
        if (!dataWithoutAmount || dataWithoutAmount.length === 0) {
          hasMore = false;
          break;
        }
        
        // Continuar mas sem calcular receita (amount_cents não existe)
        from += pageSize;
        hasMore = dataWithoutAmount.length === pageSize;
        continue;
      }
      
      if (error) {
        // ✅ CORREÇÃO: Tratar erros 400/404/42501 adequadamente
        const isTableError = error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('relation');
        const isPermissionError = error.code === '42501' || error.message?.includes('permission');
        const isGeneric400 = error.code === '400' && !error.message?.includes('amount_cents') && !error.message?.includes('column');
        
        if (isTableError || isPermissionError) {
          // Tabela não existe ou sem permissão, retornar 0
          return 0;
        }
        
        if (isGeneric400) {
          // Erro 400 genérico (pode ser RLS), retornar 0 silenciosamente
          return 0;
        }
        
        console.warn('Erro ao buscar receita via paginação:', error);
        break;
      }
    
    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      let filteredData = data;
      if (filters?.provider === 'hotmart') filteredData = data.filter(isHotmartOrder);
      
      const pageRevenue = filteredData.reduce((sum: number, o: any) => {
        const amount = o.amount_cents || 0;
        return sum + (typeof amount === 'number' && !isNaN(amount) ? amount : 0);
      }, 0);
      
      totalRevenue += pageRevenue;
      from += pageSize;
      hasMore = data.length === pageSize;
    }
    }
  } catch (err: any) {
    // Tratar qualquer erro inesperado
    console.warn('Erro inesperado ao buscar receita:', err);
    return 0;
  }
  
  return totalRevenue / 100; // Converter centavos para reais
}

/**
 * Hook para carregar estatísticas do dashboard
 * Cache: 2 minutos (dados mudam frequentemente)
 */
export function useDashboardStats() {
  return useQuery({
    queryKey: queryKeys.dashboard.stats(),
    queryFn: async () => {
      // ✅ CORREÇÃO: Para mais de 1 milhão de registros, usar RPC ou contar via paginação
      // Tentar primeiro com count exact, se falhar, usar paginação
      
      let totalOrders = 0;
      let paidOrders = 0;
      let hotmartOrders = 0;
      
      try {
        // ✅ OTIMIZAÇÃO: Tentar count exact primeiro com timeout de 5 segundos
        const countPromise = Promise.all([
          supabase.from("orders").select("id", { count: 'exact', head: true }),
          supabase.from("orders").select("id", { count: 'exact', head: true }).eq("status", "paid"),
          supabase.from("orders")
            .select("id", { count: 'exact', head: true })
            .eq("status", "paid")
            .or("payment_provider.eq.hotmart,provider.eq.hotmart"),
        ]);
        
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Count timeout')), 3000)
        );
        
        const [
          totalOrdersResult,
          paidOrdersResult,
          hotmartOrdersResult
        ] = await Promise.race([countPromise, timeoutPromise]) as any[];
        
        totalOrders = totalOrdersResult.count ?? 0;
        paidOrders = paidOrdersResult.count ?? 0;
        hotmartOrders = hotmartOrdersResult.count ?? 0;
        
        // ✅ CORREÇÃO: Se o count retornar um valor suspeitamente baixo (< 50k), usar paginação
        // Mas apenas se realmente necessário (não bloquear carregamento)
        if (!totalOrdersResult.count || totalOrdersResult.count < 50000) {
          // ✅ OTIMIZAÇÃO: Usar paginação apenas em background, não bloquear
          // Por enquanto, usar os valores do count mesmo que baixos
          // A paginação pode ser feita em background se necessário
          console.warn('Count retornou valor baixo, mas usando mesmo assim para performance');
        }
      } catch (error: any) {
        // ✅ CORREÇÃO: Tratar erros específicos (400, 404, 42501)
        const isTableError = error?.code === '42P01' || error?.message?.includes('does not exist');
        const isPermissionError = error?.code === '42501' || error?.message?.includes('permission');
        
        if (isTableError || isPermissionError) {
          // Tabela não existe ou sem permissão, retornar zeros
          return {
            totalOrders: 0,
            paidOrders: 0,
            hotmartOrders: 0,
            hotmartRevenue: 0,
            totalRevenueBRL: 0,
            totalRevenueBRLConverted: 0,
          };
        }
        
        // ✅ OTIMIZAÇÃO: Se timeout ou erro, usar valores do cache anterior se disponível
        const cachedData = queryClient.getQueryData(queryKeys.dashboard.stats());
        if (cachedData && typeof cachedData === 'object') {
          const cached = cachedData as any;
          totalOrders = cached.totalOrders || 0;
          paidOrders = cached.paidOrders || 0;
          hotmartOrders = cached.hotmartOrders || 0;
        }
        console.warn('Timeout ou erro ao contar pedidos, usando cache anterior:', error);
      }
      
      // ✅ OTIMIZAÇÃO: Buscar receitas com timeout de 15 segundos (aumentado para suportar milhões de pedidos)
      // Se demorar muito, usar valores do cache anterior ou 0
      let hotmartRevenue = 0;
      
      try {
        // ✅ CORREÇÃO: Buscar receitas em paralelo, mas com timeout maior
        const revenuePromise = fetchRevenuePaginated({ provider: 'hotmart' });
        
        const revenueTimeout = new Promise<number>((resolve) => 
          setTimeout(() => {
            // ✅ CORREÇÃO: Se timeout, tentar usar cache, senão retornar 0
            const cachedData = queryClient.getQueryData(queryKeys.dashboard.stats());
            if (cachedData && typeof cachedData === 'object') {
              const cached = cachedData as any;
              resolve(cached.hotmartRevenue || 0);
            } else {
              resolve(0);
            }
          }, 15000) // ✅ CORREÇÃO: Timeout aumentado para 15 segundos
        );
        
        const result = await Promise.race([revenuePromise, revenueTimeout]);
        hotmartRevenue = result;
      } catch (error: any) {
        // ✅ CORREÇÃO: Tratar erros específicos
        const isTableError = error?.code === '42P01' || error?.message?.includes('does not exist');
        const isPermissionError = error?.code === '42501' || error?.message?.includes('permission');
        
        if (isTableError || isPermissionError) {
          hotmartRevenue = 0;
        } else {
          // Erro - usar cache anterior ou 0
          const cachedData = queryClient.getQueryData(queryKeys.dashboard.stats());
          if (cachedData && typeof cachedData === 'object') {
            const cached = cachedData as any;
            hotmartRevenue = cached.hotmartRevenue || 0;
          } else {
            hotmartRevenue = 0;
          }
        }
        console.warn('Erro ao buscar receitas, usando cache anterior ou 0:', error);
      }
      
      
      const result = {
        totalOrders,
        paidOrders,
        hotmartOrders,
        hotmartRevenue,
        totalRevenueBRL: hotmartRevenue,
        totalRevenueBRLConverted: hotmartRevenue,
      };
      
      return result;
    },
    staleTime: 5 * 60 * 1000, // ✅ OTIMIZAÇÃO: 5 minutos (dados não mudam tão rápido)
    gcTime: 15 * 60 * 1000, // ✅ OTIMIZAÇÃO: 15 minutos (mantém cache por mais tempo)
    refetchInterval: 5 * 60 * 1000, // ✅ OTIMIZAÇÃO: Atualizar a cada 5min (reduz carga)
    placeholderData: (previousData) => previousData, // ✅ OTIMIZAÇÃO: Mostrar dados anteriores enquanto carrega
    refetchOnMount: false, // ✅ OTIMIZAÇÃO: Não refetch ao montar (usa cache)
    refetchOnWindowFocus: false, // ✅ OTIMIZAÇÃO: Não refetch ao focar
  });
}

/**
 * Hook para carregar dados de vendas para gráficos
 * Cache: 3 minutos
 */
export function useSalesData(period: '7d' | '30d' | '90d' | 'month' | 'all', selectedMonth?: string) {
  return useQuery({
    queryKey: queryKeys.dashboard.salesData(period, selectedMonth),
    queryFn: async () => {
      // ✅ OTIMIZAÇÃO: Buscar apenas pedidos pagos do período necessário
      // Limitar a no máximo 10.000 pedidos para evitar timeout
      
      // Calcular período de datas
      const now = new Date();
      let startDate: Date;
      
      switch (period) {
        case '7d':
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 6);
          break;
        case '30d':
          startDate = new Date(2024, 10, 3); // 03/11/2024
          break;
        case '90d':
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 89);
          break;
        case 'month':
          if (selectedMonth) {
            const [year, month] = selectedMonth.split('-').map(Number);
            startDate = new Date(year, month - 1, 1);
          } else {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          }
          break;
        case 'all':
          startDate = new Date(0);
          break;
        default:
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 29);
      }
      
      let allOrders: any[] = [];
      let from = 0;
      const pageSize = 1000;
      const maxOrders = 200000; // Aumentado para suportar mais pedidos (200k)
      let hasMore = true;
      
      while (hasMore && allOrders.length < maxOrders) {
        // ✅ CORREÇÃO: Tentar buscar com amount_cents primeiro
        let { data: pageData, error } = await supabase
          .from("orders")
          .select("id, status, amount_cents, payment_provider, provider, created_at, paid_at")
          .eq("status", "paid")
          .gte("created_at", startDate.toISOString())
          .order("created_at", { ascending: true })
          .range(from, from + pageSize - 1);
        
        // ✅ CORREÇÃO: Se erro 400 por campo não existir, tentar sem amount_cents
        if (error && error.code === '400' && (error.message?.includes('amount_cents') || error.message?.includes('column'))) {
          const { data: dataWithoutAmount, error: errorWithoutAmount } = await supabase
            .from("orders")
            .select("id, status, payment_provider, provider, created_at")
            .eq("status", "paid")
            .gte("created_at", startDate.toISOString())
            .order("created_at", { ascending: true })
            .range(from, from + pageSize - 1);
          
          if (errorWithoutAmount) {
            const isTableError = errorWithoutAmount.code === '42P01' || errorWithoutAmount.message?.includes('does not exist');
            const isPermissionError = errorWithoutAmount.code === '42501' || errorWithoutAmount.message?.includes('permission');
            if (isTableError || isPermissionError) {
              // Retornar dados já coletados ou array vazio
              break;
            }
            throw errorWithoutAmount;
          }
          
          pageData = dataWithoutAmount;
          error = null;
        }
        
        if (error) {
          const isTableError = error.code === '42P01' || error.message?.includes('does not exist');
          const isPermissionError = error.code === '42501' || error.message?.includes('permission');
          if (isTableError || isPermissionError) {
            // Retornar dados já coletados ou array vazio
            break;
          }
          throw error;
        }
        
        if (pageData && pageData.length > 0) {
          allOrders = allOrders.concat(pageData);
          from += pageSize;
          hasMore = pageData.length === pageSize;
        } else {
          hasMore = false;
        }
      }
      
      return allOrders;
    },
    staleTime: 3 * 60 * 1000, // 3 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
  });
}

/**
 * Interface para dados agregados de vendas por dia
 */
interface SalesDataByDate {
  hotmart: number;
  count: number;
  hotmartCount: number;
}

/**
 * Interface para dados de vendas formatados para gráficos
 */
export interface SalesData {
  date: string;
  dateKey: string;
  fullDate?: string;
  hotmart: number;
  total: number;
  count: number;
  hotmartCount: number;
  totalCount: number;
}

/**
 * Interface para cache de vendas
 */
interface SalesCache {
  lastUpdate: string; // "YYYY-MM-DD"
  data: Record<string, SalesDataByDate>;
}

/**
 * Pedidos marcados manualmente (especiais)
 */
const MANUAL_ORDERS = [
  { id: '5759ca8f-44ce-43bd-af52-85a12f715bb2', date: '2025-11-07', email: 'micheledepaulad@gmail.com' },
  { id: 'bf7ccd66-2b3d-4248-839b-362c77df009a', date: '2025-11-07', email: 'lindysouto13@gmail.com' },
  { id: 'bf84ece4-e2ac-4f37-9a41-7c2aa5644227', date: '2025-11-10', email: 'machadomaciel77@gmail.com' },
  { id: 'cc23166c-3843-4f09-9560-1311b2a77058', date: '2025-11-11', email: 'mauracriscastro@gmail.com' },
  { id: 'ec87e1bf-541d-4292-b393-9aaa8fb9eacf', date: '2025-11-11', email: 'baixinhodagalo@yahoo.com.br' },
];

/**
 * Obtém a data atual no horário de Brasília
 */
function getBrasiliaDate(): { year: number; month: number; day: number; date: Date } {
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
function createBrasiliaDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 3, 0, 0, 0));
}

/**
 * Processa dados agregados de vendas e formata para gráficos
 */
function processSalesDataForCharts(
  aggregatedData: Record<string, SalesDataByDate>,
  period: '7d' | '30d' | '90d' | 'month' | 'all',
  selectedMonth?: string
): SalesData[] {
  const { year, month, day, date: todayBrasiliaUTC } = getBrasiliaDate();
  
  // Filtrar dados por período
  let filteredEntries = Object.entries(aggregatedData);
  let groupByMonth = false;
  
  if (period === '30d') {
    // Filtrar desde 03/11
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
          hotmart: values.hotmart,
          total: values.hotmart,
          count: values.count,
          hotmartCount: values.hotmartCount,
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
          hotmart: values.hotmart,
          total: values.hotmart,
          count: values.count,
          hotmartCount: values.hotmartCount,
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
          hotmart: 0,
          total: 0,
          count: 0,
          hotmartCount: 0,
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
function getCachedSalesData(): Record<string, SalesDataByDate> | null {
  if (typeof window === 'undefined') return null;
  
  const today = new Date();
  const todayKey = today.toISOString().split('T')[0];
  const cacheKey = 'sales_data_cache_v1';
  
  try {
    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData) {
      const parsed: SalesCache = JSON.parse(cachedData);
      
      if (parsed && parsed.lastUpdate && parsed.data) {
        // Se o cache foi atualizado hoje, usar ele
        if (parsed.lastUpdate === todayKey) {
          // Limpar cache antigo (manter apenas últimos 90 dias)
          const ninetyDaysAgo = new Date(today);
          ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
          
          const cleanedData: Record<string, SalesDataByDate> = {};
          Object.entries(parsed.data).forEach(([dateKey, values]) => {
            const date = new Date(dateKey);
            if (date >= ninetyDaysAgo) {
              cleanedData[dateKey] = values;
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

/**
 * Hook otimizado para carregar dados de vendas para gráficos
 * Usa cache de dias anteriores + carrega apenas o dia atual
 * Performance: 20-50x mais rápido que carregar todos os pedidos
 */
export function useSalesDataOptimized(
  period: '7d' | '30d' | '90d' | 'month' | 'all', 
  selectedMonth?: string
) {
  // Ler cache sincronamente para usar como initialData
  const cachedData = getCachedSalesData();
  const initialData = cachedData ? processSalesDataForCharts(cachedData, period, selectedMonth) : undefined;
  
  
  return useQuery({
    queryKey: queryKeys.dashboard.salesData(`optimized_${period}`, selectedMonth),
    queryFn: async () => {
      const today = new Date();
      const todayKey = today.toISOString().split('T')[0]; // YYYY-MM-DD
      const cacheKey = 'sales_data_cache_v1';
      
      // 1. Buscar dados em cache do localStorage (dias anteriores)
      let historicalData: Record<string, SalesDataByDate> = {};
      
      if (typeof window !== 'undefined') {
        try {
          const cachedData = localStorage.getItem(cacheKey);
          if (cachedData) {
            const parsed: SalesCache = JSON.parse(cachedData);
            
            // Validar estrutura do cache
            if (parsed && parsed.lastUpdate && parsed.data) {
              // Se o cache foi atualizado hoje, usar ele
              if (parsed.lastUpdate === todayKey) {
                historicalData = parsed.data || {};
                
                // Limpar cache antigo (manter apenas últimos 90 dias)
                const ninetyDaysAgo = new Date(today);
                ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
                
                const cleanedData: Record<string, SalesDataByDate> = {};
                Object.entries(historicalData).forEach(([dateKey, values]) => {
                  const date = new Date(dateKey);
                  if (date >= ninetyDaysAgo) {
                    cleanedData[dateKey] = values;
                  }
                });
                
                historicalData = cleanedData;
              } else {
                // Cache desatualizado, limpar
                localStorage.removeItem(cacheKey);
              }
            }
          }
        } catch (e) {
          console.error('Erro ao ler cache de vendas:', e);
          localStorage.removeItem(cacheKey);
        }
      }
      
      // 2. Verificar se precisa buscar dados históricos
      // Para período '30d', sempre garantir que temos dados desde 03/11
      let needsHistoricalData = Object.keys(historicalData).length === 0;
      
      if (period === '30d' && Object.keys(historicalData).length > 0) {
        // Verificar se o cache tem dados desde 03/11
        const { year, month, day } = getBrasiliaDate();
        let startYear = year;
        if (month < 11 || (month === 11 && day < 3)) {
          startYear = year - 1;
        }
        const startDate = createBrasiliaDate(startYear, 11, 3);
        const startDateKey = `${startYear}-11-03`;
        
        // Verificar se há dados desde 03/11 no cache
        const hasDataSinceStart = Object.keys(historicalData).some(dateKey => {
          const [y, m, d] = dateKey.split('-').map(Number);
          const date = createBrasiliaDate(y, m, d);
          return date >= startDate;
        });
        
        if (!hasDataSinceStart) {
          needsHistoricalData = true;
        }
      }
      
      if (needsHistoricalData) {
        // Buscar dados históricos do período
        const { year, month, day, date: todayBrasiliaUTC } = getBrasiliaDate();
        let startDateUTC: Date;
        let endDateUTC: Date;
        
        switch (period) {
          case '7d': {
            startDateUTC = new Date(todayBrasiliaUTC);
            startDateUTC.setUTCDate(startDateUTC.getUTCDate() - 6);
            endDateUTC = new Date(todayBrasiliaUTC);
            endDateUTC.setUTCDate(endDateUTC.getUTCDate() + 1);
            endDateUTC.setUTCHours(2, 59, 59, 999);
            break;
          }
          case '30d': {
            let startYear = year;
            if (month < 11 || (month === 11 && day < 3)) {
              startYear = year - 1;
            }
            startDateUTC = createBrasiliaDate(startYear, 11, 3);
            endDateUTC = new Date(todayBrasiliaUTC);
            endDateUTC.setUTCDate(endDateUTC.getUTCDate() + 1);
            endDateUTC.setUTCHours(2, 59, 59, 999);
            break;
          }
          case '90d': {
            startDateUTC = new Date(todayBrasiliaUTC);
            startDateUTC.setUTCDate(startDateUTC.getUTCDate() - 89);
            endDateUTC = new Date(todayBrasiliaUTC);
            endDateUTC.setUTCDate(endDateUTC.getUTCDate() + 1);
            endDateUTC.setUTCHours(2, 59, 59, 999);
            break;
          }
          case 'month':
            if (selectedMonth) {
              const [selectedYear, selectedMonthNum] = selectedMonth.split('-').map(Number);
              startDateUTC = new Date(Date.UTC(selectedYear, selectedMonthNum - 1, 1, 3, 0, 0, 0));
              const lastDay = new Date(selectedYear, selectedMonthNum, 0).getDate();
              endDateUTC = new Date(Date.UTC(selectedYear, selectedMonthNum - 1, lastDay, 3, 0, 0, 0));
              endDateUTC.setUTCDate(endDateUTC.getUTCDate() + 1);
              endDateUTC.setUTCHours(2, 59, 59, 999);
            } else {
              startDateUTC = new Date(Date.UTC(year, month - 1, 1, 3, 0, 0, 0));
              const lastDay = new Date(year, month, 0).getDate();
              endDateUTC = new Date(Date.UTC(year, month - 1, lastDay, 3, 0, 0, 0));
              endDateUTC.setUTCDate(endDateUTC.getUTCDate() + 1);
              endDateUTC.setUTCHours(2, 59, 59, 999);
            }
            break;
          case 'all':
            startDateUTC = new Date(0);
            endDateUTC = new Date(todayBrasiliaUTC);
            endDateUTC.setUTCDate(endDateUTC.getUTCDate() + 1);
            endDateUTC.setUTCHours(2, 59, 59, 999);
            break;
        }
        
        // Buscar pedidos históricos do período (paginação para não sobrecarregar)
        let allHistoricalOrders: any[] = [];
        let from = 0;
        const pageSize = 1000;
        const maxOrders = 200000; // Limite para primeira carga
        let hasMore = true;
        
        while (hasMore && allHistoricalOrders.length < maxOrders) {
          const { data: pageData, error: pageError } = await supabase
            .from("orders")
            .select("id, status, amount_cents, payment_provider, provider, created_at")
            .eq("status", "paid")
            .gte("created_at", startDateUTC.toISOString())
            .lte("created_at", endDateUTC.toISOString())
            .order("created_at", { ascending: true })
            .range(from, from + pageSize - 1);
          
          if (pageError) {
            console.error('Erro ao buscar pedidos históricos:', pageError);
            break;
          }
          
          if (pageData && pageData.length > 0) {
            allHistoricalOrders = allHistoricalOrders.concat(pageData);
            from += pageSize;
            hasMore = pageData.length === pageSize;
          } else {
            hasMore = false;
          }
        }
        
        
        // Processar pedidos históricos e mesclar com cache existente
        const fetchedHistoricalData: Record<string, SalesDataByDate> = {};
        const manualOrderIds = new Set(MANUAL_ORDERS.map(o => o.id));
        
        allHistoricalOrders.forEach(order => {
          if (manualOrderIds.has(order.id)) return;
          
          const createdDate = new Date(order.created_at!);
          const dateStr = createdDate.toLocaleString('en-US', { 
            timeZone: 'America/Sao_Paulo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          });
          const [monthStr, dayStr, yearStr] = dateStr.split('/');
          const dateKey = `${yearStr}-${monthStr.padStart(2, '0')}-${dayStr.padStart(2, '0')}`;
          
          if (!fetchedHistoricalData[dateKey]) {
            fetchedHistoricalData[dateKey] = { hotmart: 0, count: 0, hotmartCount: 0 };
          }
          
          const amount = (order.amount_cents || 0) / 100;
          
          if (isNaN(amount) || amount <= 0) return;
          
          fetchedHistoricalData[dateKey].hotmart += amount;
          fetchedHistoricalData[dateKey].hotmartCount += 1;
          fetchedHistoricalData[dateKey].count += 1;
        });
        
        // Mesclar dados buscados com cache existente (cache tem prioridade para evitar duplicação)
        Object.entries(fetchedHistoricalData).forEach(([dateKey, values]) => {
          if (!historicalData[dateKey]) {
            // Se não existe no cache, adicionar
            historicalData[dateKey] = values;
          } else {
            // Se existe no cache, somar os valores (pode haver pedidos novos)
            historicalData[dateKey].hotmart += values.hotmart;
            historicalData[dateKey].count += values.count;
            historicalData[dateKey].hotmartCount += values.hotmartCount;
          }
        });
        
        // Processar pedidos manuais do período histórico
        const manualOrdersInPeriod = MANUAL_ORDERS.filter(o => {
          const orderDate = new Date(o.date);
          return orderDate >= startDateUTC && orderDate <= endDateUTC;
        });
        
        if (manualOrdersInPeriod.length > 0) {
          const manualOrderIdsInPeriod = new Set(manualOrdersInPeriod.map(o => o.id));
          const { data: manualOrdersData } = await supabase
            .from("orders")
            .select("id, amount_cents, created_at")
            .in("id", Array.from(manualOrderIdsInPeriod))
            .eq("status", "paid");
          
          if (manualOrdersData) {
            manualOrdersData.forEach(order => {
              // Usar a data do MANUAL_ORDERS ao invés de created_at para garantir data correta
              const manualOrder = manualOrdersInPeriod.find(mo => mo.id === order.id);
              if (!manualOrder) return;
              
              const dateKey = manualOrder.date; // Já está no formato YYYY-MM-DD
              
              if (!historicalData[dateKey]) {
                historicalData[dateKey] = { hotmart: 0, count: 0, hotmartCount: 0 };
              }
              
              const amount = (order.amount_cents || 0) / 100;
              if (!isNaN(amount) && amount > 0) {
                historicalData[dateKey].hotmart += amount;
                historicalData[dateKey].hotmartCount += 1;
                historicalData[dateKey].count += 1;
              }
            });
          }
        }
        
      }
      
      // 3. Buscar APENAS pedidos do dia atual (muito mais rápido!)
      const { year, month, day } = getBrasiliaDate();
      const todayStart = new Date(Date.UTC(year, month - 1, day, 3, 0, 0, 0)); // 00:00:00 BRT
      const todayEnd = new Date(Date.UTC(year, month - 1, day, 26, 59, 59, 999)); // 23:59:59 BRT (26h UTC = 23:59 BRT)
      
      let todayData: Record<string, SalesDataByDate> = {};
      
      try {
        // Buscar pedidos do dia atual
        const { data: todayOrders, error } = await supabase
          .from("orders")
          .select("id, status, amount_cents, payment_provider, provider, created_at")
          .eq("status", "paid")
          .gte("created_at", todayStart.toISOString())
          .lte("created_at", todayEnd.toISOString());
        
        if (error) {
          console.error('Erro ao buscar pedidos do dia atual:', error);
          // Se falhar, usar apenas cache
          if (Object.keys(historicalData).length === 0) {
            throw error;
          }
        } else if (todayOrders && todayOrders.length > 0) {
          // Processar pedidos do dia atual
          const todayKeyFormatted = todayKey;
          todayData[todayKeyFormatted] = {
            hotmart: 0,
            count: 0,
            hotmartCount: 0,
          };
          
          const manualOrderIds = new Set(MANUAL_ORDERS.map(o => o.id));
          
          todayOrders.forEach(order => {
            // Excluir pedidos manuais (serão processados separadamente se necessário)
            if (manualOrderIds.has(order.id)) return;
            
            const amount = (order.amount_cents || 0) / 100;
            
            if (isNaN(amount) || amount <= 0) return;
            
            todayData[todayKeyFormatted].hotmart += amount;
            todayData[todayKeyFormatted].hotmartCount += 1;
            todayData[todayKeyFormatted].count += 1;
          });
          
          // Processar pedidos manuais do dia atual se houver
          const manualOrdersToday = MANUAL_ORDERS.filter(o => o.date === todayKey);
          if (manualOrdersToday.length > 0) {
            const manualOrderIdsToday = new Set(manualOrdersToday.map(o => o.id));
            const { data: manualOrdersData } = await supabase
              .from("orders")
              .select("id, amount_cents")
              .in("id", Array.from(manualOrderIdsToday))
              .eq("status", "paid");
            
            if (manualOrdersData) {
              manualOrdersData.forEach(order => {
                const amount = (order.amount_cents || 0) / 100;
                if (!isNaN(amount) && amount > 0) {
                  todayData[todayKeyFormatted].hotmart += amount;
                  todayData[todayKeyFormatted].hotmartCount += 1;
                  todayData[todayKeyFormatted].count += 1;
                }
              });
            }
          }
        }
      } catch (error) {
        console.error('Erro ao processar pedidos do dia atual:', error);
        // Se falhar, continuar apenas com cache
      }
      
      // 4. Combinar dados históricos (cache) + dados do dia atual
      const combinedData = { ...historicalData, ...todayData };
      
      // 5. Atualizar cache (salvar TODOS os dados para próxima execução)
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(cacheKey, JSON.stringify({
            lastUpdate: todayKey,
            data: combinedData,
          }));
        } catch (e) {
          console.error('Erro ao salvar cache:', e);
          // Se localStorage estiver cheio, limpar cache antigo
          try {
            const ninetyDaysAgo = new Date(today);
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 30); // Manter apenas 30 dias
            
            const cleanedData: Record<string, SalesDataByDate> = {};
            Object.entries(combinedData).forEach(([dateKey, values]) => {
              const date = new Date(dateKey);
              if (date >= ninetyDaysAgo) {
                cleanedData[dateKey] = values;
              }
            });
            
            localStorage.setItem(cacheKey, JSON.stringify({
              lastUpdate: todayKey,
              data: cleanedData,
            }));
          } catch (e2) {
            console.error('Erro ao limpar e salvar cache:', e2);
          }
        }
      }
      
      // 6. Processar e formatar dados para gráficos
      const result = processSalesDataForCharts(combinedData, period, selectedMonth);
      
      
      return result;
    },
    initialData: initialData, // ✅ Mostrar dados do cache imediatamente
    placeholderData: (previousData) => previousData || initialData, // ✅ Manter dados anteriores visíveis durante refetch
    staleTime: 1 * 60 * 1000, // 1 minuto (dados do dia atual mudam frequentemente)
    gcTime: 24 * 60 * 60 * 1000, // 24 horas
  });
}

/**
 * Hook para carregar pedidos com filtros e paginação otimizada
 * Carrega apenas campos necessários para melhor performance
 * Cache: 5 minutos
 */
export function useOrders(filters?: {
  search?: string;
  status?: string;
  plan?: string;
  provider?: string;
  page?: number;
  pageSize?: number;
}) {
  // ✅ CORREÇÃO: Se page/pageSize não forem fornecidos, carregar tudo
  const usePagination = filters?.page !== undefined && filters?.pageSize !== undefined;
  const page = filters?.page && filters.page > 0 ? filters.page : 1;
  const pageSize = filters?.pageSize && filters.pageSize > 0 ? filters.pageSize : 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  return useQuery({
    queryKey: queryKeys.orders.list(filters),
    queryFn: async () => {
      // ✅ CORREÇÃO: Query simplificada e robusta
      try {
        // Query básica - primeiro verificar quais campos existem
        // Tentar com campos mínimos primeiro
        let baseQuery = supabase
          .from("orders")
          .select("id, customer_email, status, plan, created_at")
          .order("created_at", { ascending: false });
        
        // Aplicar filtros na query do Supabase
        if (filters?.status && filters.status !== 'all') {
          baseQuery = baseQuery.eq('status', filters.status);
        }
        
        if (filters?.plan && filters.plan !== 'all') {
          baseQuery = baseQuery.eq('plan', filters.plan);
        }
        
        // ✅ CORREÇÃO: Não filtrar provider aqui - será filtrado no código após buscar
        // O Supabase não aceita .or() quando há outros filtros aplicados
        // O filtro será aplicado no código abaixo após buscar os dados
        
        // ✅ BUSCA OTIMIZADA: Buscar por email, telefone, nome ou ID
        let allOrders: any[] = [];
        
        if (filters?.search) {
          const searchTerm = filters.search.trim();
        
          // Verificar se o termo parece ser um UUID
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(searchTerm);
          
          if (isUUID) {
            // Busca direta por UUID (mais rápida)
            const { data, error } = await baseQuery.eq('id', searchTerm).limit(1);
            if (error) throw error;
            allOrders = data || [];
          } else {
            // ✅ CORREÇÃO: Buscar TODOS os resultados quando não há paginação
            const phoneSearchTerm = searchTerm.replace(/[\s\-\(\)\+]/g, '');

            // Buscar todos os resultados (sem limite)
            // ✅ CORREÇÃO: Remover amount_cents que pode não existir
            const { data: emailData, error: emailError } = await supabase
            .from("orders")
            .select(`
              id,
              customer_email,
              status,
              plan,
              created_at
            `)
              .ilike('customer_email', `%${searchTerm}%`)
              .order("created_at", { ascending: false });

            if (emailError) {
              console.error(`❌ Erro ao buscar por email:`, emailError);
            }

            // ✅ CORREÇÃO: Buscar por telefone apenas se o campo existir
            let phoneData: any[] = [];
            try {
              const { data, error: phoneError } = await supabase
                .from("orders")
                .select(`
                  id,
                  customer_email,
                  status,
                  plan,
                  created_at
                `)
                .ilike('customer_whatsapp', `%${phoneSearchTerm}%`)
                .order("created_at", { ascending: false });
              
              if (phoneError) {
                console.warn(`⚠️ Erro ao buscar por telefone (campo pode não existir):`, phoneError);
              } else {
                phoneData = data || [];
              }
            } catch (e) {
              // Se o campo customer_whatsapp não existir, ignorar erro
              console.warn('⚠️ Campo customer_whatsapp não acessível, ignorando busca por telefone');
            }
            
            const combinedResults = new Map();

            (emailData || []).forEach((order: any) => combinedResults.set(order.id, order));
            (phoneData || []).forEach((order: any) => combinedResults.set(order.id, order));

            allOrders = Array.from(combinedResults.values());
            
            // ✅ Aplicar filtros DEPOIS de buscar
            if (filters?.status && filters.status !== 'all') {
              allOrders = allOrders.filter(o => o.status === filters.status);
            }
            
            if (filters?.plan && filters.plan !== 'all') {
              allOrders = allOrders.filter(o => o.plan === filters.plan);
            }
            
            // ✅ CORREÇÃO: Provider será buscado separadamente se necessário
            // Por enquanto, não filtrar por provider na busca
            
            // Retornar resultados da busca
            const finalTotal = allOrders.length;
            return { orders: allOrders, total: finalTotal };
          }
        } else {
          // ✅ CORREÇÃO: Sem busca, carregar tudo se não houver paginação
          if (!usePagination) {
            // Carregar tudo usando paginação interna do Supabase
          let allData: any[] = [];
          let from = 0;
          const pageSize = 1000;
          let hasMore = true;
          
          while (hasMore) {
            const { data, error } = await baseQuery.range(from, from + pageSize - 1);
            
            if (error) {
              // ✅ CORREÇÃO: Tratar erros 400/404/42501 adequadamente
              const isTableError = error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('relation');
              const isPermissionError = error.code === '42501' || error.message?.includes('permission');
              
              if (isTableError) {
                // Tabela não existe, retornar array vazio
                console.warn('Tabela orders não encontrada');
                return { orders: [], total: 0 };
              }
              
              if (isPermissionError) {
                // Erro de permissão, retornar array vazio
                console.warn('Sem permissão para acessar orders');
                return { orders: [], total: 0 };
              }
              
              // Outro erro, logar e retornar dados já coletados
              console.warn(`Erro ao carregar pedidos (página ${from / pageSize + 1}):`, error);
              break; // Parar paginação mas retornar dados já coletados
            }
            
            if (data && data.length > 0) {
              allData = allData.concat(data);
              from += pageSize;
              hasMore = data.length === pageSize;
            } else {
              hasMore = false;
            }
          }
          
          allOrders = allData;
          
          // ✅ CORREÇÃO: Provider será buscado separadamente se necessário
          const totalCount = allOrders.length;
          
          return { orders: allOrders, total: totalCount };
        } else {
          // Com paginação, carregar página atual
          // ✅ CORREÇÃO: Buscar count separadamente para evitar erro 400
          const countQuery = supabase
            .from("orders")
            .select("id", { count: 'exact', head: true });
          
          // Aplicar mesmos filtros no count
          if (filters?.status && filters.status !== 'all') {
            countQuery.eq('status', filters.status);
          }
          if (filters?.plan && filters.plan !== 'all') {
            countQuery.eq('plan', filters.plan);
          }
          
          const [dataResult, countResult] = await Promise.all([
            baseQuery.range(from, to),
            countQuery
          ]);

          if (dataResult.error) {
            // ✅ CORREÇÃO: Tratar erros adequadamente em vez de lançar
            const isTableError = dataResult.error.code === '42P01' || dataResult.error.message?.includes('does not exist');
            const isPermissionError = dataResult.error.code === '42501' || dataResult.error.message?.includes('permission');
            
            if (isTableError || isPermissionError) {
              return { orders: [], total: 0 };
            }
            
            console.warn(`Erro ao carregar pedidos paginados:`, dataResult.error);
            // Retornar array vazio em vez de lançar erro
            return { orders: [], total: 0 };
          }

          allOrders = dataResult.data || [];
          
          // ✅ CORREÇÃO: Provider será buscado separadamente se necessário
          const totalCount = countResult.count ?? allOrders.length;

          return { orders: allOrders, total: totalCount };
          }
        }
        } catch (error: any) {
        console.error('❌ Erro ao carregar pedidos:', error);
        console.error('❌ Detalhes completos:', {
          message: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint,
          stack: error?.stack
        });
        // Retornar array vazio em caso de erro para não quebrar a UI
        return { orders: [], total: 0 };
      }
    },
    staleTime: 3 * 60 * 1000, // ✅ OTIMIZAÇÃO: Cache de 3 minutos (reduz requisições)
    gcTime: 10 * 60 * 1000, // ✅ OTIMIZAÇÃO: 10 minutos (mantém cache por mais tempo)
    refetchOnMount: false, // ✅ OTIMIZAÇÃO: Usar cache quando disponível
    refetchOnWindowFocus: false, // ✅ Não recarregar ao focar (melhor UX)
    refetchInterval: false, // ✅ CORREÇÃO: Não recarregar em segundo plano
    retry: (failureCount, error: any) => {
      // ✅ CORREÇÃO: Não retentar em erros 400/404/42501 (tabela não existe ou sem permissão)
      if (error?.code === '400' || error?.code === '404' || error?.code === '42P01' || error?.code === '42501') {
        return false;
      }
      // Retentar até 1 vez para outros erros
      return failureCount < 1;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000),
  });
}

/**
 * Hook para buscar estatísticas agregadas de pedidos (contagens e somas)
 * Usa count: 'exact' e agregações SQL para performance - não carrega dados completos
 * Cache: 2 minutos
 */
export function useOrdersStats(filters?: {
  search?: string;
  status?: string;
  plan?: string;
  provider?: string;
}) {
  // ✅ OTIMIZAÇÃO: Verificar se há filtros - se não houver, usar dados do dashboard
  const hasFilters = filters?.search || 
                     (filters?.status && filters.status !== 'all') ||
                     (filters?.plan && filters.plan !== 'all') ||
                     (filters?.provider && filters.provider !== 'all');
  
  return useQuery({
    queryKey: queryKeys.orders.stats(filters),
    queryFn: async () => {
      // ✅ OTIMIZAÇÃO CRÍTICA: Se não há filtros, usar dados do dashboard do cache
      // Isso evita recalcular milhões de pedidos - ganho de performance de 10-100x
      if (!hasFilters) {
        try {
          // Tentar pegar do cache global do React Query (sem fazer requisição)
          const cachedData = queryClient.getQueryData(queryKeys.dashboard.stats());
          
          if (cachedData && typeof cachedData === 'object') {
            const dashboard = cachedData as any;
            // Calcular pending baseado no total - paid (aproximado, mas rápido)
            const pending = Math.max(0, (dashboard.totalOrders || 0) - (dashboard.paidOrders || 0));
            
            return {
              total: dashboard.totalOrders || 0,
              paid: dashboard.paidOrders || 0,
              totalPaid: dashboard.totalRevenueBRLConverted || 0,
              pending: pending,
              conversionRate: dashboard.totalOrders > 0 
                ? ((dashboard.paidOrders || 0) / dashboard.totalOrders) * 100 
                : 0
            };
          }
        } catch (error) {
          // Se falhar, continuar com busca normal abaixo
        }
      }
      // Se houver busca textual, precisamos buscar os resultados e calcular
      // (limitação do Supabase para buscas textuais com count)
      if (filters?.search && filters.search.trim()) {
        const searchTerm = filters.search.trim();
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(searchTerm);
        
        let allOrderIds: string[] = [];
        
        if (isUUID) {
          // Busca por UUID - buscar apenas o ID
          const { data } = await supabase
            .from("orders")
            .select("id, status, amount_cents")
            .eq('id', searchTerm)
            .limit(1);
          
          if (data && data.length > 0) {
            allOrderIds = [data[0].id];
          }
        } else {
          // Busca por email ou telefone - buscar IDs paginados
          const phoneSearchTerm = searchTerm.replace(/[\s\-\(\)\+]/g, '');
          
          // Buscar por email
          const { data: emailData } = await supabase
            .from("orders")
            .select("id, status, amount_cents")
            .ilike('customer_email', `%${searchTerm}%`)
            .limit(10000); // Limite alto para buscar todos os resultados
          
          // Buscar por telefone
          const { data: phoneData } = await supabase
            .from("orders")
            .select("id, status, amount_cents")
            .ilike('customer_whatsapp', `%${phoneSearchTerm}%`)
            .limit(10000);
          
          // Combinar resultados únicos
          const combinedMap = new Map();
          (emailData || []).forEach((order: any) => combinedMap.set(order.id, order));
          (phoneData || []).forEach((order: any) => combinedMap.set(order.id, order));
          
          allOrderIds = Array.from(combinedMap.keys());
        }
        
        // Aplicar filtros adicionais nos resultados encontrados
        let filteredOrderIds = allOrderIds;
        
        // Buscar dados completos dos pedidos encontrados para aplicar filtros
        if (allOrderIds.length > 0) {
          let query = supabase
            .from("orders")
            .select("id, status, plan, payment_provider, amount_cents")
            .in('id', allOrderIds);
          
          if (filters?.status && filters.status !== 'all') {
            query = query.eq('status', filters.status);
          }
          
          if (filters?.plan && filters.plan !== 'all') {
            query = query.eq('plan', filters.plan);
          }
          
          if (filters?.provider && filters.provider !== 'all') {
            query = query.eq('payment_provider', filters.provider);
          }
          
          const { data: filteredData } = await query;
          
          if (filteredData) {
            // Calcular estatísticas dos resultados filtrados
            const total = filteredData.length;
            const paid = filteredData.filter(o => o.status === 'paid');
            const totalPaid = paid.reduce((sum, o) => sum + (o.amount_cents || 0), 0) / 100;
            const pending = filteredData.filter(o => o.status === 'pending').length;
            const conversionRate = total > 0 ? (paid.length / total) * 100 : 0;
            
            return {
              total,
              paid: paid.length,
              totalPaid,
              pending,
              conversionRate
            };
          }
        }
        
        // Se não encontrou nada, retornar zeros
        return {
          total: 0,
          paid: 0,
          totalPaid: 0,
          pending: 0,
          conversionRate: 0
        };
      }
      
      // Sem busca textual - usar count: 'exact' com fallback para paginação (mesma lógica do dashboard)
      let total = 0;
      let paid = 0;
      let pending = 0;
      
      try {
        // Tentar count exact primeiro
        const buildBaseQuery = () => {
          let query = supabase.from("orders").select("id", { count: 'exact', head: true });
          
          if (filters?.status && filters.status !== 'all') {
            query = query.eq('status', filters.status);
          }
          
          if (filters?.plan && filters.plan !== 'all') {
            query = query.eq('plan', filters.plan);
          }
          
          if (filters?.provider && filters.provider !== 'all') {
            query = query.eq('payment_provider', filters.provider);
          }
          
          return query;
        };
        
        const [
          totalResult,
          paidResult,
          pendingResult
        ] = await Promise.all([
          buildBaseQuery(),
          buildBaseQuery().eq('status', 'paid'),
          buildBaseQuery().eq('status', 'pending')
        ]);
        
        total = totalResult.count ?? 0;
        paid = paidResult.count ?? 0;
        pending = pendingResult.count ?? 0;
        
        // ✅ CORREÇÃO: Se o count retornar um valor suspeitamente baixo ou null, usar paginação
        // Mesma lógica do useDashboardStats
        if (!totalResult.count || totalResult.count < 50000) {
          // Contar via paginação (mais lento mas preciso)
          total = await countOrdersPaginated({
            status: filters?.status !== 'all' ? filters.status : undefined,
            provider: filters?.provider === 'hotmart' ? 'hotmart' : undefined,
            plan: filters?.plan !== 'all' ? filters.plan : undefined
          });
          
          paid = await countOrdersPaginated({ 
            status: 'paid',
            provider: filters?.provider === 'hotmart' ? 'hotmart' : undefined,
            plan: filters?.plan !== 'all' ? filters.plan : undefined
          });
          
          pending = await countOrdersPaginated({ 
            status: 'pending',
            provider: filters?.provider === 'hotmart' ? 'hotmart' : undefined,
            plan: filters?.plan !== 'all' ? filters.plan : undefined
          });
        }
      } catch (error) {
        console.error('Erro ao contar pedidos com count exact, usando paginação:', error);
        // Fallback para contagem via paginação
        total = await countOrdersPaginated({
          status: filters?.status !== 'all' ? filters.status : undefined,
          provider: filters?.provider === 'hotmart' ? 'hotmart' : undefined,
          plan: filters?.plan !== 'all' ? filters.plan : undefined
        });
        
        paid = await countOrdersPaginated({ 
          status: 'paid',
          provider: filters?.provider === 'hotmart' ? 'hotmart' : undefined,
          plan: filters?.plan !== 'all' ? filters.plan : undefined
        });
        
        pending = await countOrdersPaginated({ 
          status: 'pending',
          provider: filters?.provider === 'hotmart' ? 'hotmart' : undefined,
          plan: filters?.plan !== 'all' ? filters.plan : undefined
        });
      }
      
      // ✅ OTIMIZAÇÃO: Buscar soma de valores pagos de forma mais eficiente
      // Se não há filtros, usar dados do dashboard (já em cache)
      // Se há filtros, buscar apenas o necessário
      let totalPaid = 0;
      
      if (paid > 0) {
        const hasPlanFilter = filters?.plan && filters.plan !== 'all';
        const hasProviderFilter = filters?.provider && filters.provider !== 'all';
        
        if (hasProviderFilter && filters?.provider !== 'hotmart') {
          totalPaid = 0;
        } else if (!hasPlanFilter) {
          totalPaid = await fetchRevenuePaginated({ provider: 'hotmart' });
        } else {
          let from = 0;
          const pageSize = 1000;
          let hasMore = true;
          let totalCents = 0;

          while (hasMore) {
            let query = supabase
              .from("orders")
              .select("amount_cents, payment_provider, provider")
              .eq('status', 'paid')
              .order("created_at", { ascending: false });

            if (filters?.plan && filters.plan !== 'all') {
              query = query.eq('plan', filters.plan);
            }

            const { data, error } = await query.range(from, from + pageSize - 1);

            if (error) {
              const isTableError = error.code === '42P01' || error.message?.includes('does not exist');
              const isPermissionError = error.code === '42501' || error.message?.includes('permission');
              const isColumnError = error.code === '400' && (error.message?.includes('amount_cents') || error.message?.includes('column'));

              if (isTableError || isPermissionError || isColumnError) {
                break;
              }

              break;
            }

            if (!data || data.length === 0) {
              hasMore = false;
              break;
            }

            const hotmartData = data.filter(isHotmartOrder);
            totalCents += hotmartData.reduce((sum, o) => sum + (o.amount_cents || 0), 0);

            from += pageSize;
            hasMore = data.length === pageSize;
          }

          totalPaid = totalCents / 100;
        }
      }
      
      const conversionRate = total > 0 ? (paid / total) * 100 : 0;
      
      return {
        total,
        paid,
        totalPaid,
        pending,
        conversionRate
      };
    },
    staleTime: 5 * 60 * 1000, // ✅ OTIMIZAÇÃO: 5 minutos (dados não mudam tão rápido)
    gcTime: 15 * 60 * 1000, // ✅ OTIMIZAÇÃO: 15 minutos (mantém cache por mais tempo)
    refetchOnMount: false, // ✅ Não refetch ao montar (usa cache)
    refetchOnWindowFocus: false, // ✅ Não refetch ao focar
    refetchOnReconnect: false, // ✅ Não refetch ao reconectar
    placeholderData: (previousData) => previousData, // ✅ Mostrar dados anteriores enquanto carrega
    retry: (failureCount, error: any) => {
      // ✅ CORREÇÃO: Não retentar em erros 400/404/42501
      if (error?.code === '400' || error?.code === '404' || error?.code === '42P01' || error?.code === '42501') {
        return false;
      }
      return failureCount < 1;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000),
  });
}

/**
 * Hook para carregar releases (músicas prontas para enviar)
 * Cache: 3 minutos
 */
export function useReleases() {
  return useQuery({
    queryKey: queryKeys.releases.list(),
    queryFn: async () => {
      // ✅ CORREÇÃO: Começar com query mínima e expandir progressivamente
      // Isso evita erro 400 se algum campo não existir
      
      // Tentativa 1: Query mínima (apenas campos que definitivamente devem existir)
      let { data: songs, error } = await supabase
        .from('songs')
        .select('id, order_id, status, audio_url, created_at')
        .eq('status', 'ready')
        .not('audio_url', 'is', null)
        .order('created_at', { ascending: false });
      
      // Se funcionou, tentar adicionar mais campos (silenciosamente)
      // IMPORTANTE: Não tentar expandir se a query mínima já retornou dados
      // Isso evita erros 400 desnecessários no console
      // Os dados mínimos são suficientes para a aplicação funcionar
      
      // Se precisar de campos adicionais, buscar apenas os que são realmente necessários
      // e que sabemos que existem (baseado na estrutura do banco)
      if (!error && songs && songs.length > 0) {
        // Tentar adicionar apenas campos que são mais prováveis de existir
        // Começar com quiz_id e title (campos básicos)
        try {
          const songIds = songs.map((s: any) => s.id).slice(0, 100); // Limitar para evitar URLs muito longas
          
          const { data: expandedSongs, error: expandedError } = await supabase
            .from('songs')
            .select('id, quiz_id, title, variant_number, cover_url, lyrics, release_at')
            .in('id', songIds);
          
          // Se funcionou, mesclar os dados
          if (!expandedError && expandedSongs) {
            const expandedMap = new Map(expandedSongs.map((s: any) => [s.id, s]));
            songs = songs.map((song: any) => ({
              ...song,
              ...(() => {
                const expanded = expandedMap.get(song.id) as unknown;
                if (expanded && typeof expanded === 'object') return expanded as Record<string, unknown>;
                return {};
              })()
            }));
          }
          // Se deu erro, continuar com dados mínimos (não logar erro)
        } catch (expandError) {
          // Erro ao tentar expandir, continuar com dados mínimos
          // Não fazer nada - songs já tem os dados básicos necessários
        }
      }
      
      // Tratar erros 400/404 graciosamente
      if (error) {
        const isTableNotFound = error.code === 'PGRST116' || 
                               error.code === '42P01' || 
                               error.code === '404' ||
                               error.message?.includes('does not exist') ||
                               error.message?.includes('relation') ||
                               error.message?.includes('not found');
        
        if (isTableNotFound || error.code === '400') {
          if (process.env.NODE_ENV === 'development') {
            console.warn('Erro ao buscar songs (tabela/campo pode não existir):', error);
          }
          return [];
        }
        
        throw error;
      }
      
      // ✅ Filtrar manualmente: apenas músicas sem released_at (se o campo existir)
      // Se released_at não existir, todas as músicas serão incluídas
      const songsWithoutReleasedAt = (songs || []).filter((song: any) => {
        // Se released_at não existir no objeto, incluir a música
        // Se existir mas for null, incluir a música
        return !song.released_at;
      });
      
      const songsWithAudio = songsWithoutReleasedAt.filter((s: any) => s.audio_url && s.audio_url.trim() !== '') || [];
      
      if (songsWithAudio.length === 0) {
        return [];
      }
      
      // Buscar orders, quizzes e jobs
      const orderIds = Array.from(new Set(songsWithAudio.map(s => s.order_id).filter(Boolean)));
      const quizIds = Array.from(new Set(songsWithAudio.map(s => s.quiz_id).filter(Boolean)));
      
      // ✅ OTIMIZAÇÃO: Buscar email_logs de forma eficiente
      // Limitar a busca para evitar URLs muito longas (máximo 100 order_ids por vez)
      // Como estamos ordenando por created_at desc, os primeiros são os mais recentes
      const MAX_ORDER_IDS_FOR_EMAIL_LOGS = 100;
      const limitedOrderIds = orderIds.slice(0, MAX_ORDER_IDS_FOR_EMAIL_LOGS);
      
      const [ordersData, quizzesData, jobsData, emailLogsResult] = await Promise.all([
        supabase.from('orders').select('id, customer_email, customer_whatsapp, plan, magic_token, quiz_id').in('id', orderIds),
        supabase.from('quizzes').select('id, about_who, style').in('id', quizIds),
        supabase.from('jobs').select('id, order_id, created_at, suno_task_id').in('order_id', orderIds).order('created_at', { ascending: false }),
        // Buscar logs apenas para os primeiros order_ids (mais recentes)
        // Isso evita URLs muito longas que causam erro 400
        // ✅ CORREÇÃO: Tratar erro 404 graciosamente (tabela pode não existir)
        limitedOrderIds.length > 0 
          ? (async () => {
              const result = await supabase.from('email_logs')
                .select('song_id, order_id, status, sent_at')
                .in('order_id', limitedOrderIds)
                .eq('email_type', 'music_released');
              
              // Se erro 404/400, retornar array vazio silenciosamente
              if (result.error) {
                const isTableNotFound = result.error.code === 'PGRST116' || 
                                       result.error.code === '42P01' || 
                                       result.error.code === '404' ||
                                       result.error.message?.includes('does not exist') ||
                                       result.error.message?.includes('relation') ||
                                       result.error.message?.includes('not found');
                
                if (isTableNotFound || result.error.code === '400') {
                  return { data: [], error: null };
                }
              }
              
              return result;
            })()
          : Promise.resolve({ data: [], error: null })
      ]);
      
      const emailLogs = emailLogsResult;
      
      
      const ordersMap = new Map(ordersData.data?.map(o => [o.id, o]) || []);
      const quizzesMap = new Map(quizzesData.data?.map(q => [q.id, q]) || []);
      const emailMap = new Map();
      // ✅ CORREÇÃO: Verificar se emailLogs tem dados antes de processar
      if (emailLogs.data && !emailLogs.error) {
        emailLogs.data.forEach((log: any) => {
          if (log.song_id) {
        emailMap.set(log.song_id, { status: log.status, sent_at: log.sent_at });
          }
      });
      }
      
      // ✅ CORREÇÃO: Agrupar músicas por job (não por email)
      // Para cada order_id, pegar apenas as 2 músicas do job mais recente
      // Músicas do mesmo job são criadas quase simultaneamente (mesma requisição Suno)
      
      // Agrupar músicas por order_id
      const groupedByOrder = new Map<string, any[]>();
      songsWithAudio.forEach((song: any) => {
        if (!groupedByOrder.has(song.order_id)) {
          groupedByOrder.set(song.order_id, []);
        }
        groupedByOrder.get(song.order_id)!.push(song);
      });
      
      // Para cada order_id, pegar apenas as 2 músicas mais recentes do job mais recente
      const finalGroups = new Map<string, any>();
      
      groupedByOrder.forEach((songs, orderId) => {
        const order = ordersMap.get(orderId) as any;
        if (!order) return;
        
        // Ordenar músicas por created_at (mais recente primeiro)
        const sortedSongs = [...songs].sort((a: any, b: any) => {
          const dateA = new Date(a.created_at || 0).getTime();
          const dateB = new Date(b.created_at || 0).getTime();
          return dateB - dateA;
        });
        
        // ✅ CORREÇÃO: Agrupar músicas que foram criadas juntas (mesmo job = mesma requisição)
        // Músicas do mesmo job são criadas quase simultaneamente (diferença < 1 minuto)
        // e têm variant_number sequenciais (1 e 2, ou 3 e 4, etc.)
        // IMPORTANTE: Cada job gera exatamente 2 músicas (variants 1 e 2)
        const jobGroups: any[][] = [];
        let currentGroup: any[] = [];
        let lastCreatedAt: number | null = null;
        let lastVariantNumber: number | null = null;
        
        sortedSongs.forEach((song: any) => {
          const songCreatedAt = new Date(song.created_at || 0).getTime();
          const songVariant = song.variant_number || 0;
          
          // Verificar se faz parte do mesmo job:
          // 1. Criadas juntas (diferença < 1 minuto - mais restritivo)
          // 2. Variant numbers sequenciais (diferença exata de 1: 1-2, 3-4, etc.)
          // 3. Limitar grupo a no máximo 2 músicas (cada job gera 2 músicas)
          const timeDiff = lastCreatedAt ? (lastCreatedAt - songCreatedAt) : 0;
          const isWithinTimeWindow = lastCreatedAt === null || timeDiff < 60 * 1000; // 1 minuto
          const isSequential = lastVariantNumber === null || Math.abs(songVariant - lastVariantNumber) === 1; // Diferença exata de 1
          const groupNotFull = currentGroup.length < 2; // Limitar a 2 músicas
          
          const isSameJob = isWithinTimeWindow && isSequential && groupNotFull;
          
          if (isSameJob) {
            // Mesmo job (criadas juntas, variants sequenciais e grupo ainda não completo)
            currentGroup.push(song);
          } else {
            // Novo job - finalizar grupo anterior e começar novo
            if (currentGroup.length > 0) {
              jobGroups.push(currentGroup);
            }
            currentGroup = [song];
          }
          lastCreatedAt = songCreatedAt;
          lastVariantNumber = songVariant;
        });
        
        if (currentGroup.length > 0) {
          jobGroups.push(currentGroup);
        }
        
        // ✅ CORREÇÃO: Pegar apenas o grupo mais recente (primeiro) e garantir exatamente 2 músicas
        // Se o grupo tiver mais de 2, pegar apenas as 2 mais recentes
        // Se o grupo tiver menos de 2, não criar card
        if (jobGroups.length > 0) {
          const mostRecentJobSongs = jobGroups[0].slice(0, 2);
          
          // ✅ VALIDAÇÃO CRÍTICA: Criar card se tiver pelo menos 1 música pronta
          // Removida validação rígida de 2 músicas para permitir liberar músicas únicas ou ímpares
          if (mostRecentJobSongs.length > 0) {
            const quiz = mostRecentJobSongs[0].quiz_id ? quizzesMap.get(mostRecentJobSongs[0].quiz_id) as any : null;
            const orderQuiz = order?.quiz_id ? quizzesMap.get(order.quiz_id) as any : null;
            const finalQuiz = quiz || orderQuiz;
            
            const enrichedSongs = mostRecentJobSongs.map((song: any) => {
              const emailInfo = emailMap.get(song.id);
              return {
                ...song,
                email_sent: emailInfo?.status === 'sent' || emailInfo?.status === 'delivered',
                email_sent_at: emailInfo?.sent_at
              };
            });
            
            const groupKey = order.customer_email || 'Email não encontrado';
            
            finalGroups.set(groupKey, {
              songs: enrichedSongs,
              email: order.customer_email || 'Email não encontrado',
              customer_whatsapp: order.customer_whatsapp || null,
              about: finalQuiz?.about_who || 'N/A',
              plan: order.plan || 'unknown',
              magic_token: order.magic_token || null,
              order_ids: [orderId]
            });
          }
        }
      });
      
      return Array.from(finalGroups.entries()).map(([id, data]) => ({
        id,
        ...data
      }));
    },
    staleTime: 3 * 60 * 1000, // 3 minutos
    gcTime: 5 * 60 * 1000, // 5 minutos
  });
}

/**
 * Hook para mutation de release (liberar e enviar músicas)
 */
export function useReleaseMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: string | string[] | { orderIds: string | string[], songs?: any[] }) => {
      const startTime = Date.now();
      
      try {
        // ✅ CORREÇÃO: Aceitar orderIds (string/array) ou objeto com orderIds e songs
        let orderIds: string | string[];
        let preloadedSongs: any[] | undefined;
        
        if (typeof params === 'string' || Array.isArray(params)) {
          // Formato antigo: apenas orderIds
          orderIds = params;
          preloadedSongs = undefined;
        } else {
          // Formato novo: objeto com orderIds e songs
          orderIds = params.orderIds;
          preloadedSongs = params.songs;
        }
        
        // ✅ CORREÇÃO: Validar orderIds antes de processar
        if (!orderIds) {
          console.error('❌ [Release] orderIds é null/undefined');
          throw new Error('IDs dos pedidos não fornecidos');
        }
        
      const orderIdsArray = Array.isArray(orderIds) ? orderIds : [orderIds];
        
        // ✅ CORREÇÃO: Validar que todos os IDs são válidos
        const validOrderIds = orderIdsArray.filter(id => id && typeof id === 'string' && id.trim() !== '');
        
        if (validOrderIds.length === 0) {
          console.error('❌ [Release] Nenhum ID válido após filtro');
          throw new Error('Nenhum ID de pedido válido fornecido');
        }
      
        // ✅ CORREÇÃO CRÍTICA: Usar músicas pré-carregadas se disponíveis (evita query lenta)
        let songs, fetchError;
        
        if (preloadedSongs && preloadedSongs.length > 0) {
          songs = preloadedSongs.filter((s: any) => 
            s.status === 'ready' && 
            !s.released_at && 
            s.audio_url && 
            validOrderIds.includes(s.order_id)
          );
        } else {
          // ✅ FALLBACK: Buscar músicas apenas se não foram pré-carregadas
          const fetchStart = Date.now();
          
          // ✅ ESTRATÉGIA: Tentar Edge Function primeiro (mais rápido, bypass RLS)
          try {
            const edgeFunctionPromise = supabase.functions.invoke('admin-get-ready-songs', {
              body: { orderIds: validOrderIds }
            });
            
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => {
                reject(new Error('Edge Function timeout'));
              }, 8000)
            );
            
            const result = await Promise.race([edgeFunctionPromise, timeoutPromise]) as any;
            
            if (result.error) {
              throw result.error;
            }
            
            if (result.data?.songs) {
              songs = result.data.songs;
            } else {
              throw new Error('Resposta inesperada da Edge Function');
            }
            
          } catch (edgeError: any) {
            // ✅ FALLBACK: Query direta com timeout
            try {
              let query = supabase
            .from('songs')
                .select('id, variant_number, title, audio_url, status, order_id, released_at, created_at');
              
              if (validOrderIds.length === 1) {
                query = query.eq('order_id', validOrderIds[0]);
              } else {
                query = query.in('order_id', validOrderIds);
              }
              
              // ✅ CORREÇÃO: Não usar released_at na query (campo pode não existir)
              // Filtrar manualmente no código depois
              let queryPromise = query
            .eq('status', 'ready')
                .order('created_at', { ascending: false })
                .limit(20);
              
              // ✅ CORREÇÃO CRÍTICA: Adicionar timeout de 8 segundos
              const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => {
                  reject(new Error('Timeout: Query direta demorou mais de 8 segundos'));
                }, 8000)
              );
              
              // Executar query com timeout
              const result = await Promise.race([queryPromise, timeoutPromise]) as any;
              
              // Filtrar manualmente: apenas músicas sem released_at (se o campo existir)
              const songsWithoutReleasedAt = (result.data || []).filter((song: any) => !song.released_at);
              
              songs = songsWithoutReleasedAt;
              fetchError = result.error;
            } catch (queryError: any) {
              const fetchTime = Date.now() - fetchStart;
              console.error('❌ [Release] Erro na query direta do Supabase:', queryError);
              console.error('❌ [Release] Tempo decorrido antes do erro:', fetchTime, 'ms');
              console.error('❌ [Release] Error message:', queryError?.message);
              console.error('❌ [Release] Error name:', queryError?.name);
              console.error('❌ [Release] Stack trace:', queryError?.stack);
              fetchError = queryError;
            }
          }
        }
        
      
        if (fetchError) {
          console.error('❌ [Release] Erro ao buscar músicas:', fetchError);
          console.error('❌ [Release] Stack trace:', new Error().stack);
          throw new Error(`Erro ao buscar músicas: ${fetchError.message || fetchError.toString()}`);
        }
        
        if (!songs || songs.length === 0) {
          throw new Error('Nenhuma música pronta encontrada para liberar');
        }
      
      // ✅ CORREÇÃO: Filtrar músicas com áudio primeiro
      const songsWithAudio = songs.filter(s => s.audio_url && s.audio_url.trim() !== '');
        
        if (songsWithAudio.length === 0) {
          console.error('❌ [Release] Nenhuma música com áudio encontrada');
          throw new Error('Nenhuma música com áudio');
        }
      
      // ✅ CORREÇÃO: Se houver mais de 2 músicas, selecionar apenas as 2 mais recentes
      // Ordenar por created_at (mais recente primeiro) ou variant_number (maior = mais recente)
      let songsToRelease = songsWithAudio;
      if (songsWithAudio.length > 2) {
        // Ordenar por created_at descendente (mais recente primeiro) ou variant_number descendente
        songsToRelease = [...songsWithAudio].sort((a, b) => {
          // Tentar ordenar por created_at primeiro, se disponível
          if (a.created_at && b.created_at) {
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          }
          // Fallback: ordenar por variant_number (maior = mais recente)
          return (b.variant_number || 0) - (a.variant_number || 0);
        }).slice(0, 2); // Pegar apenas as 2 primeiras (mais recentes)
      }
      
      // ✅ VALIDAÇÃO: Garantir que temos pelo menos 1 música para liberar
      // Removida validação rígida de 2 músicas - pode liberar com 1 ou mais
      if (songsToRelease.length < 1) {
          console.error(`❌ [Release] Nenhuma música para liberar: ${songsToRelease.length}`);
        throw new Error(`Nenhuma música válida encontrada para liberar.`);
      }
      
      // Atualizar para released
      const updateStart = Date.now();
      const now = new Date().toISOString();
      const songIds = songsToRelease.map(s => s.id);
      
        let updatedSongs, updateError;
        try {
          const result = await supabase
        .from('songs')
        .update({ 
          released_at: now, 
          status: 'released',
          updated_at: now
        })
        .in('id', songIds)
        .select();
          
          updatedSongs = result.data;
          updateError = result.error;
        } catch (updateErr: any) {
          console.error('❌ [Release] Erro na atualização:', updateErr);
          updateError = updateErr;
        }
        
        if (updateError) {
          console.error('❌ [Release] Erro ao atualizar músicas:', updateError);
          console.error('❌ [Release] Stack trace:', new Error().stack);
          throw new Error(`Erro ao atualizar músicas: ${updateError.message || updateError.toString()}`);
        }
        
        if (!updatedSongs || updatedSongs.length === 0) {
          console.error('❌ [Release] Nenhuma música foi atualizada');
          throw new Error('Nenhuma música foi atualizada');
        }
      
        // ✅ CORREÇÃO CRÍTICA: Usar songsToRelease[0] ao invés de songsWithAudio[0]
        // songsToRelease são as músicas selecionadas para release (2 mais recentes)
      const firstSong = songsToRelease[0]; // ✅ CORREÇÃO: Usar songsToRelease
      const orderIdForEmail = firstSong.order_id || validOrderIds[0];
      
        // Buscar dados completos do pedido (email, telefone, quiz)
        let order, orderError;
        try {
          const result = await supabase
        .from('orders')
        .select(`
          customer_email,
          customer_whatsapp,
          plan,
          magic_token,
          quiz_id,
          quizzes:quiz_id (
            about_who
          )
        `)
        .eq('id', orderIdForEmail)
        .single();
          
          order = result.data;
          orderError = result.error;
        } catch (err: any) {
          console.error('❌ [Release] Erro ao buscar order:', err);
          orderError = err;
        }
        
        if (orderError) {
          console.error('❌ [Release] Erro ao buscar order:', orderError);
        }
      
      if (!order?.customer_email) {
        toast.warning(`Músicas liberadas, mas email do cliente não encontrado.`);
          // Ainda retornar sucesso pois as músicas foram liberadas
        return updatedSongs;
      }
      
        // ✅ CORREÇÃO CRÍTICA: Aguardar envio do email com timeout para evitar travamento
        const emailStart = Date.now();
        
        // Preparar dados para webhook
        const about = (order?.quizzes as any)?.about_who || 'N/A';
        
        try {
          // ✅ NOVO: Enviar email e webhook em paralelo
          const emailPromise = supabase.functions.invoke(
            'send-music-released-email',
            {
              body: {
                songId: firstSong.id,
                orderId: orderIdForEmail,
                force: true
              }
            }
          );
          
          const emailTimeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout: Envio de email demorou mais de 15 segundos')), 15000)
          );
          
          // Chamar webhook em paralelo (não bloqueante)
          const webhookPromise = order ? sendReleaseWebhook(
            {
              id: orderIdForEmail,
              customer_email: order.customer_email || '',
              customer_whatsapp: order.customer_whatsapp || null,
              plan: order.plan || 'unknown',
              magic_token: order.magic_token || ''
            },
            songsToRelease.map(s => ({
              id: s.id,
              title: s.title || 'Música sem título',
              variant_number: s.variant_number || 1,
              audio_url: s.audio_url || undefined
            })),
            about
          ) : Promise.resolve();
          
          // Executar email e webhook em paralelo
          const [emailResult, webhookResult] = await Promise.allSettled([
            Promise.race([emailPromise, emailTimeout]),
            webhookPromise
          ]);
          
          // Processar resultado do email
          let emailData, emailError;
          if (emailResult.status === 'fulfilled') {
            const result = emailResult.value as any;
            emailData = result.data;
            emailError = result.error;
          } else {
            emailError = emailResult.reason;
          }
          
          // Processar resultado do webhook (não bloquear)
          if (webhookResult.status === 'rejected') {
            console.error('❌ [Release] [Webhook] Erro ao enviar webhook (não bloqueante):', webhookResult.reason);
          }
        
        if (emailError) {
            throw new Error(`Erro ao enviar email: ${emailError.message || 'Erro desconhecido'}`);
        }
        
        // ✅ CORREÇÃO: Verificar resposta da Edge Function corretamente
        if (emailData && (emailData.success === true || emailData.email_id)) {
            toast.success(`✅ ${updatedSongs.length} música(s) liberada(s) e email enviado para ${order.customer_email}!`);
        } else {
            // Tentar adicionar à fila como fallback antes de lançar erro
            try {
              await supabase.from('email_queue').insert({
                order_id: orderIdForEmail,
                song_id: firstSong.id,
                recipient_email: order.customer_email,
                status: 'pending',
                next_retry_at: new Date().toISOString(),
                metadata: {
                  song_title: firstSong.title,
                  variant_number: firstSong.variant_number,
                  fallback_reason: emailData?.error || 'Resposta inesperada da função de envio'
                }
              });
              
              toast.warning(`Músicas liberadas, mas houve problema ao enviar email. Email será enviado em breve.`);
            } catch (queueError: any) {
              console.error("❌ [Release] [Email] Erro ao adicionar à fila:", queueError);
              toast.warning(`Músicas liberadas, mas houve problema ao enviar email. Verifique os logs.`);
            }
        }
        
      } catch (emailError: any) {
          // Tentar adicionar à fila como fallback
        try {
          const queueResult = await supabase.from('email_queue').insert({
            order_id: orderIdForEmail,
            song_id: firstSong.id,
            recipient_email: order.customer_email,
            status: 'pending',
            next_retry_at: new Date().toISOString(),
            metadata: {
              song_title: firstSong.title,
              variant_number: firstSong.variant_number,
                fallback_reason: emailError?.message || 'Erro desconhecido'
            }
          });
          
          if (queueResult.error) {
            console.error("❌ [Release] [Email] Erro ao adicionar à fila:", queueResult.error);
          }
          
          toast.warning(`Músicas liberadas, mas houve erro ao enviar email. Email será enviado em breve.`);
        } catch (queueError: any) {
            console.error("❌ [Release] [Email] Erro ao adicionar à fila:", queueError);
            toast.warning(`Músicas liberadas, mas houve erro ao enviar email: ${emailError?.message || 'Erro desconhecido'}`);
        }
          
          // ✅ CORREÇÃO CRÍTICA: Não lançar erro - músicas já foram liberadas
          // Apenas logar o erro para debug, mas continuar o fluxo
          // Isso garante que onSuccess seja chamado e o card saia do loading
      }
      
      return updatedSongs;
        
      } catch (error: any) {
        const totalTime = Date.now() - startTime;
        console.error(`❌ [Release] ===== ERRO NA MUTATION =====`);
        console.error(`❌ [Release] Erro capturado:`, error);
        console.error(`❌ [Release] Error message:`, error?.message);
        console.error(`❌ [Release] Error stack:`, error?.stack);
        console.error(`⏱️ [Release] Total time antes do erro: ${totalTime}ms`);
        console.error(`🚀 [Release] ===== FIM DA MUTATION (erro) =====`);
        // Re-lançar o erro para que o onError do mutation possa tratá-lo
        throw error;
      }
    },
    onSuccess: (data) => {
      
      try {
        // ✅ CORREÇÃO: Invalidar cache imediatamente e forçar refetch
        queryClient.invalidateQueries({ queryKey: queryKeys.releases.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.songs.all });
        
        // Forçar refetch imediato para atualizar a UI
        queryClient.refetchQueries({ queryKey: queryKeys.releases.all })
          .then(() => {
          })
          .catch((error) => {
            console.error('❌ [Release] [onSuccess] Erro ao refetch:', error);
            console.error('❌ [Release] [onSuccess] Stack:', error?.stack);
          });
      } catch (cacheError: any) {
        console.error('❌ [Release] [onSuccess] Erro ao invalidar cache:', cacheError);
        console.error('❌ [Release] [onSuccess] Stack:', cacheError?.stack);
      }
    },
    onError: (error: any) => {
      console.error('❌ [Release] [onError] Mutation erro capturado');
      console.error('❌ [Release] [onError] Error object:', error);
      console.error('❌ [Release] [onError] Error message:', error?.message);
      console.error('❌ [Release] [onError] Error toString:', error?.toString());
      console.error('❌ [Release] [onError] Stack trace:', error?.stack);
      
      const errorMessage = error?.message || error?.toString() || 'Erro desconhecido';
      console.error('❌ [Release] [onError] Mensagem de erro final:', errorMessage);
      
      toast.error(`Erro ao liberar músicas: ${errorMessage}`);
    },
  });
}

/**
 * Hook para carregar músicas com filtros otimizado
 * Carrega apenas campos necessários e limita lotes iniciais
 * Cache: 3 minutos
 */
export function useSongs(filters?: {
  search?: string;
  status?: string;
  period?: string;
}) {
  return useQuery({
    queryKey: queryKeys.songs.list(filters),
    queryFn: async () => {
      // ✅ OTIMIZAÇÃO: Carregar apenas campos necessários (sem lyrics completo)
      let allSongs: any[] = [];
      let from = 0;
      const batchSize = 1000; // ✅ Aumentado para carregar mais rápido
      let hasMore = true;
      let batchCount = 0;
      // ✅ CORREÇÃO: Não usar filtro status - causa 400. Filtrar client-side.
      const STATUSES_FOR_ADMIN = ['approved', 'released', 'ready', 'failed'];

      // ✅ CORREÇÃO: Evitar query com joins (orders, quizzes) - causa 400 no schema remoto
      // Usar apenas colunas da tabela songs; customer_email/about_who preenchidos via fallback
      const BARE_SELECT = 'id, order_id, title, status, audio_url, cover_url, created_at';
      const MINIMAL_SELECT = 'id, order_id, title, variant_number, status, audio_url, cover_url, release_at, released_at, created_at';

      const buildQuery = (useMinimal: boolean) =>
        supabase
          .from("songs")
          .select(useMinimal ? MINIMAL_SELECT : BARE_SELECT)
          .order("created_at", { ascending: false })
          .range(from, from + batchSize - 1);

      let useMinimal = true;
      const testMinimal = await supabase.from("songs").select(MINIMAL_SELECT).limit(1);
      if (testMinimal.error) useMinimal = false;

      // ✅ Aumentado para suportar até 1 milhão de gerações (2 milhões de músicas = 2000 lotes)
      while (hasMore && batchCount < 2000) {
        batchCount++;

        let { data, error } = await buildQuery(useMinimal);
        if (error?.code === '400' && batchCount === 1 && useMinimal) {
          const fallback = await buildQuery(false);
          if (!fallback.error && fallback.data) {
            data = fallback.data;
            error = null;
            useMinimal = false;
          }
        }

        // Tratar erros 400/404 graciosamente
        if (error) {
          const isTableNotFound = error.code === 'PGRST116' ||
                                 error.code === '42P01' ||
                                 error.code === '404' ||
                                 error.message?.includes('does not exist') ||
                                 error.message?.includes('relation') ||
                                 error.message?.includes('not found');

          if (isTableNotFound || error.code === '400') {
            if (process.env.NODE_ENV === 'development') {
              console.warn(`Erro ao buscar songs no lote ${batchCount} (tabela/campo pode não existir):`, error);
            }
            hasMore = false;
            break;
          }

          console.error(`❌ Erro no lote ${batchCount}:`, error);
          throw error;
        }

        if (data && data.length > 0) {
          const toAdd = (data as any[])
            .filter((s: any) => STATUSES_FOR_ADMIN.includes(s?.status))
            .map((s: any) => ({
              ...s,
              variant_number: s?.variant_number ?? 1,
              release_at: s?.release_at ?? null,
              released_at: s?.released_at ?? null,
              orders: s?.orders ?? { customer_email: 'N/A' },
              quizzes: s?.quizzes ?? { about_who: null, style: null },
            }));
          allSongs = allSongs.concat(toAdd);

          // Se retornou menos que o batch size, não há mais dados
          hasMore = data.length === batchSize;
          from += batchSize;
        } else {
          hasMore = false;
        }
      }

      return allSongs;
    },
    staleTime: 3 * 60 * 1000, // ✅ Reduzido para 3 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: (failureCount, error: any) => {
      // ✅ CORREÇÃO: Não retentar em erros 400/404/42501
      if (error?.code === '400' || error?.code === '404' || error?.code === '42P01' || error?.code === '42501') {
        return false;
      }
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000),
  });
}

/**
 * Hook para carregar pagamentos
 * Cache: 5 minutos
 */
export function usePayments(filters?: {
  search?: string;
  status?: string;
  plan?: string;
  provider?: string;
  dateFilter?: string;
}) {
  return useQuery({
    queryKey: queryKeys.payments.list(filters),
    queryFn: async () => {
      // ✅ OTIMIZAÇÃO: Buscar pedidos com limite aumentado
      let allOrders: any[] = [];
      let from = 0;
      const pageSize = 1000;
      const maxOrders = 1000000; // Aumentado para suportar até 1 milhão de pedidos
      let hasMore = true;
      
      while (hasMore && allOrders.length < maxOrders) {
        // ✅ CORREÇÃO: Começar com query mínima e expandir progressivamente
        // Tentativa 1: Query mínima (apenas campos essenciais)
        let query = supabase
          .from('orders')
          .select('id, status, plan, created_at, user_id')
          .order('created_at', { ascending: false });
        
        // ✅ OTIMIZAÇÃO: Aplicar filtros na query (mais eficiente)
        if (filters?.status && filters.status !== 'all') {
          query = query.eq('status', filters.status);
        }
        
        if (filters?.plan && filters.plan !== 'all') {
          query = query.eq('plan', filters.plan);
        }
        
        if (filters?.provider && filters.provider !== 'all') {
          query = query.eq('payment_provider', filters.provider);
        }
        
        let { data: pageData, error } = await query.range(from, from + pageSize - 1);
        
        // Se funcionou, tentar expandir com mais campos (silenciosamente)
        if (!error && pageData) {
          try {
            let expandedQuery = supabase
              .from('orders')
              .select(`
                id,
                status,
                plan,
                amount_cents,
                provider,
                created_at,
                paid_at,
                user_id,
                profiles!inner(display_name, email)
              `)
              .order('created_at', { ascending: false });
            
            if (filters?.status && filters.status !== 'all') {
              expandedQuery = expandedQuery.eq('status', filters.status);
            }
            
            if (filters?.plan && filters.plan !== 'all') {
              expandedQuery = expandedQuery.eq('plan', filters.plan);
            }
            
            if (filters?.provider && filters.provider !== 'all') {
              expandedQuery = expandedQuery.eq('payment_provider', filters.provider);
            }
            
            const { data: expandedData, error: expandedError } = await expandedQuery.range(from, from + pageSize - 1);
            
            if (!expandedError && expandedData) {
              pageData = expandedData;
            }
            // Se deu erro na expansão, continuar com dados mínimos
          } catch (expandError) {
            // Continuar com dados mínimos
          }
        }
        
        // Tratar erros 400/404 graciosamente
        if (error) {
          const isTableNotFound = error.code === 'PGRST116' || 
                                 error.code === '42P01' || 
                                 error.code === '404' ||
                                 error.message?.includes('does not exist') ||
                                 error.message?.includes('relation') ||
                                 error.message?.includes('not found');
          
          if (isTableNotFound || error.code === '400') {
            if (process.env.NODE_ENV === 'development') {
              console.warn(`Erro ao buscar pagamentos (página ${from / pageSize + 1}) - tabela/campo pode não existir:`, error);
            }
            // Parar o loop e retornar o que já foi coletado
            hasMore = false;
            break;
          }
          
          throw error;
        }
        
        if (pageData && pageData.length > 0) {
          allOrders = allOrders.concat(pageData);
          from += pageSize;
          hasMore = pageData.length === pageSize;
        } else {
          hasMore = false;
        }
      }
      
      return allOrders;
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
  });
}

/**
 * Hook para carregar créditos Suno
 * Cache: 2 minutos
 */
export function useSunoCredits() {
  return useQuery({
    queryKey: queryKeys.dashboard.sunoCredits(),
    queryFn: async () => {
      // ✅ CORREÇÃO: Retornar valores padrão imediatamente se houver qualquer erro
      const defaultValues = {
        total: 0,
        used: 0,
        remaining: 0,
      };
      
      try {
        // ✅ CORREÇÃO: Tentar buscar apenas campos básicos primeiro (evita erro 400)
        let { data, error } = await supabase
          .from('suno_credits')
          .select('credits, credits_used')
          .limit(1)
          .maybeSingle();
        
        // Se falhar com erro 400 (campo não existe) ou 404 (tabela não existe), tentar alternativas
        if (error) {
          const isTableError = error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('relation');
          const isColumnError = error.code === '400' || error.message?.includes('column') || error.message?.includes('PGRST');
          
          if (isTableError) {
            // Tabela não existe, retornar valores padrão
            return defaultValues;
          }
          
          if (isColumnError) {
            // Campos não existem, tentar buscar todos os campos
            const { data: data2, error: error2 } = await supabase
              .from('suno_credits')
              .select('*')
              .limit(1)
              .maybeSingle();
            
            if (error2) {
              // Se ainda falhar, retornar valores padrão
              return defaultValues;
            }
            
            if (data2) {
              // Mapear campos disponíveis
              data = {
                credits: data2.credits || data2.total_credits || 0,
                credits_used: data2.credits_used || data2.used_credits || 0,
              };
              error = null;
            } else {
              return defaultValues;
            }
          } else {
            // Outro tipo de erro, retornar valores padrão
            return defaultValues;
          }
        }
        
        // ✅ CORREÇÃO: Usar colunas disponíveis (compatibilidade com diferentes estruturas)
        if (!data) {
          return defaultValues;
        }
        
        const total = data.total_credits || data.credits || 0;
        const used = data.used_credits || data.credits_used || 0;
        const remaining = data.remaining_credits || (total - used);
        
        return {
          total: Number(total) || 0,
          used: Number(used) || 0,
          remaining: Math.max(0, Number(remaining) || 0),
        };
      } catch (err: any) {
        // Tratar qualquer erro inesperado
        return defaultValues;
      }
    },
    staleTime: 5 * 60 * 1000, // ✅ OTIMIZAÇÃO: 5 minutos (créditos não mudam tão rápido)
    gcTime: 10 * 60 * 1000, // ✅ OTIMIZAÇÃO: 10 minutos
    refetchInterval: 5 * 60 * 1000, // ✅ OTIMIZAÇÃO: Atualizar a cada 5min (era 1min)
  });
}

/**
 * Hook para dados estáticos (cache infinito)
 */
export function useStaticData<T>(
  key: string,
  fetcher: () => Promise<T>
) {
  return useQuery({
    queryKey: [...queryKeys.static.all, key],
    queryFn: fetcher,
    staleTime: Infinity, // Nunca fica stale
    gcTime: Infinity, // Nunca é removido do cache
  });
}
