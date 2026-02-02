import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys, queryClient } from '@/lib/queryClient';
import { 
  fetchRevenuePaginated, 
  getCachedSalesData, 
  processSalesDataForCharts, 
  getBrasiliaDate, 
  createBrasiliaDate,
  MANUAL_ORDERS 
} from './utils';

/**
 * Hook para carregar estatísticas do dashboard
 * Cache: 5 minutos (dados mudam frequentemente)
 */
export function useDashboardStats() {
  return useQuery({
    queryKey: queryKeys.dashboard.stats(),
    queryFn: async () => {
      try {
        // Tentar usar a função RPC otimizada primeiro
        const { data, error } = await supabase.rpc('get_dashboard_stats');

        if (!error && data) {
          const paidOrders = data.paidOrders || 0;
          const hotmartOrders = data.caktoOrders || paidOrders;
          const hotmartRevenue = data.caktoRevenue || data.totalRevenueBRL || 0;
          const totalRevenueBRLConverted = data.totalRevenueBRLConverted || hotmartRevenue;

          return {
            totalOrders: data.totalOrders || 0,
            paidOrders,
            hotmartOrders,
            hotmartRevenue,
            totalRevenueBRL: hotmartRevenue,
            totalRevenueBRLConverted,
          };
        }
        
        console.warn('RPC get_dashboard_stats falhou ou não existe, usando fallback manual:', error);
      } catch (e) {
        console.warn('Erro ao chamar RPC get_dashboard_stats:', e);
      }

      // FALLBACK MANUAL (Simplificado para evitar ERR_ABORTED)
      let totalOrders = 0;
      let paidOrders = 0;
      let hotmartOrders = 0;
      
      try {
        // Buscar contagens básicas sequencialmente para evitar sobrecarga
        const { count: total } = await supabase.from("orders").select("id", { count: 'exact', head: true });
        totalOrders = total || 0;

        const { count: paid } = await supabase.from("orders").select("id", { count: 'exact', head: true }).eq("status", "paid");
        paidOrders = paid || 0;
        hotmartOrders = paidOrders;
        
      } catch (error: any) {
        console.warn('Erro no fallback de contagem:', error);
        // Tentar recuperar do cache
        const cachedData = queryClient.getQueryData(queryKeys.dashboard.stats());
        if (cachedData && typeof cachedData === 'object') {
          const cached = cachedData as any;
          totalOrders = cached.totalOrders || 0;
          paidOrders = cached.paidOrders || 0;
          hotmartOrders = cached.hotmartOrders || 0;
        }
      }
      
      let hotmartRevenue = 0;
      
      try {
        hotmartRevenue = await fetchRevenuePaginated();
      } catch (error: any) {
        console.warn('Erro ao buscar receitas no fallback:', error);
        const cachedData = queryClient.getQueryData(queryKeys.dashboard.stats());
        if (cachedData && typeof cachedData === 'object') {
          const cached = cachedData as any;
          hotmartRevenue = cached.hotmartRevenue || 0;
        }
      }
      
      return {
        totalOrders,
        paidOrders,
        hotmartOrders,
        hotmartRevenue,
        totalRevenueBRL: hotmartRevenue,
        totalRevenueBRLConverted: hotmartRevenue,
      };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
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
      const now = new Date();
      let startDate: Date;
      
      switch (period) {
        case '7d':
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 6);
          break;
        case '30d':
          startDate = new Date(2024, 10, 3);
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
      const maxOrders = 200000;
      let hasMore = true;
      
      // Detectar quais campos existem
      let fieldsToSelect = "id, status, amount_cents, payment_provider, provider, created_at, paid_at";
      try {
        const testQuery = await supabase
          .from("orders")
          .select("id, status, amount_cents, payment_provider, provider, created_at, paid_at")
          .eq("status", "paid")
          .limit(1);
        
        if (testQuery.error && testQuery.error.code === '400' && testQuery.error.message?.includes('column')) {
          // Tentar sem paid_at
          const testQuery2 = await supabase
            .from("orders")
            .select("id, status, amount_cents, payment_provider, provider, created_at")
            .eq("status", "paid")
            .limit(1);
          
          if (testQuery2.error && testQuery2.error.code === '400' && testQuery2.error.message?.includes('column')) {
            // Tentar sem amount_cents
            fieldsToSelect = "id, status, payment_provider, provider, created_at";
            const testQuery3 = await supabase
              .from("orders")
              .select(fieldsToSelect)
              .eq("status", "paid")
              .limit(1);
            
            if (testQuery3.error && testQuery3.error.code === '400' && testQuery3.error.message?.includes('column')) {
              // Usar apenas campos básicos
              fieldsToSelect = "id, status, created_at";
            }
          } else {
            fieldsToSelect = "id, status, amount_cents, payment_provider, provider, created_at";
          }
        }
      } catch (e) {
        // Se falhar, usar campos básicos
        fieldsToSelect = "id, status, created_at";
      }

      while (hasMore && allOrders.length < maxOrders) {
        let { data: pageData, error } = await supabase
          .from("orders")
          .select(fieldsToSelect)
          .eq("status", "paid")
          .gte("created_at", startDate.toISOString())
          .order("created_at", { ascending: true })
          .range(from, from + pageSize - 1);
        
        if (error) {
          const isTableError = error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('relation');
          const isPermissionError = error.code === '42501' || error.message?.includes('permission');
          const isColumnError = error.code === '400' && (error.message?.includes('column') || error.message?.includes('PGRST'));
          
          if (isTableError || isPermissionError) {
            break;
          }
          
          if (isColumnError) {
            // Tentar com campos mais simples
            if (fieldsToSelect.includes('paid_at')) {
              fieldsToSelect = fieldsToSelect.replace(', paid_at', '').replace('paid_at, ', '');
              continue;
            }
            if (fieldsToSelect.includes('amount_cents')) {
              fieldsToSelect = fieldsToSelect.replace(', amount_cents', '').replace('amount_cents, ', '');
              continue;
            }
            if (fieldsToSelect.includes('payment_provider')) {
              fieldsToSelect = "id, status, created_at";
              continue;
            }
            break;
          }
          
          if (process.env.NODE_ENV === 'development') {
            console.warn('Erro ao buscar pedidos:', error);
          }
          break;
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
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
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
  const cachedData = getCachedSalesData();
  const initialData = cachedData ? processSalesDataForCharts(cachedData, period, selectedMonth) : undefined;
  
  return useQuery({
    queryKey: queryKeys.dashboard.salesData(`optimized_${period}`, selectedMonth),
    queryFn: async () => {
      const today = new Date();
      const todayKey = today.toISOString().split('T')[0];
      const cacheKey = 'sales_data_cache_v1';
      
      let historicalData: Record<string, any> = {};
      
      if (typeof window !== 'undefined') {
        try {
          const cachedData = localStorage.getItem(cacheKey);
          if (cachedData) {
            const parsed = JSON.parse(cachedData);
            
            if (parsed && parsed.lastUpdate && parsed.data) {
              if (parsed.lastUpdate === todayKey) {
                historicalData = parsed.data || {};
                
                const ninetyDaysAgo = new Date(today);
                ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
                
                const cleanedData: Record<string, any> = {};
                Object.entries(historicalData).forEach(([dateKey, values]) => {
                  const date = new Date(dateKey);
                  if (date >= ninetyDaysAgo) {
                    cleanedData[dateKey] = values;
                  }
                });
                
                historicalData = cleanedData;
              } else {
                localStorage.removeItem(cacheKey);
              }
            }
          }
        } catch (e) {
          console.error('Erro ao ler cache de vendas:', e);
          localStorage.removeItem(cacheKey);
        }
      }
      
      let needsHistoricalData = Object.keys(historicalData).length === 0;
      
      if (period === '30d' && Object.keys(historicalData).length > 0) {
        const { year, month, day } = getBrasiliaDate();
        let startYear = year;
        if (month < 11 || (month === 11 && day < 3)) {
          startYear = year - 1;
        }
        const startDate = createBrasiliaDate(startYear, 11, 3);
        
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
        
        let allHistoricalOrders: any[] = [];
        let from = 0;
        const pageSize = 1000;
        const maxOrders = 200000;
        let hasMore = true;
        
        // Detectar quais campos existem para query histórica
        let historicalFieldsToSelect = "id, status, amount_cents, payment_provider, provider, created_at";
        try {
          const testQuery = await supabase
            .from("orders")
            .select(historicalFieldsToSelect)
            .eq("status", "paid")
            .limit(1);
          
          if (testQuery.error && testQuery.error.code === '400' && testQuery.error.message?.includes('column')) {
            // Tentar sem amount_cents
            historicalFieldsToSelect = "id, status, payment_provider, provider, created_at";
            const testQuery2 = await supabase
              .from("orders")
              .select(historicalFieldsToSelect)
              .eq("status", "paid")
              .limit(1);
            
            if (testQuery2.error && testQuery2.error.code === '400' && testQuery2.error.message?.includes('column')) {
              // Usar apenas campos básicos
              historicalFieldsToSelect = "id, status, created_at";
            }
          }
        } catch (e) {
          historicalFieldsToSelect = "id, status, created_at";
        }
        
        while (hasMore && allHistoricalOrders.length < maxOrders) {
          const { data: pageData, error: pageError } = await supabase
            .from("orders")
            .select(historicalFieldsToSelect)
            .eq("status", "paid")
            .gte("created_at", startDateUTC.toISOString())
            .lte("created_at", endDateUTC.toISOString())
            .order("created_at", { ascending: true })
            .range(from, from + pageSize - 1);
          
          if (pageError) {
            const isTableError = pageError.code === '42P01' || pageError.message?.includes('does not exist') || pageError.message?.includes('relation');
            const isPermissionError = pageError.code === '42501' || pageError.message?.includes('permission');
            const isColumnError = pageError.code === '400' && (pageError.message?.includes('column') || pageError.message?.includes('PGRST'));
            
            if (isTableError || isPermissionError) {
              break;
            }
            
            if (isColumnError) {
              // Tentar com campos mais simples
              if (historicalFieldsToSelect.includes('amount_cents')) {
                historicalFieldsToSelect = historicalFieldsToSelect.replace(', amount_cents', '').replace('amount_cents, ', '');
                continue;
              }
              if (historicalFieldsToSelect.includes('payment_provider')) {
                historicalFieldsToSelect = "id, status, created_at";
                continue;
              }
              break;
            }
            
            if (process.env.NODE_ENV === 'development') {
              console.error('Erro ao buscar pedidos históricos:', pageError);
            }
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
        
        const fetchedHistoricalData: Record<string, any> = {};
        const manualOrderIds = new Set(MANUAL_ORDERS.map((o: any) => o.id));
        
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
            fetchedHistoricalData[dateKey] = { revenue: 0, count: 0 };
          }
          
          // Verificar se campos existem antes de usar
          const hasAmountField = 'amount_cents' in order;
          
          let amount = 0;
          if (hasAmountField) {
            amount = (order.amount_cents || 0) / 100;
            if (isNaN(amount) || amount <= 0) return;
          }
          
          if (hasAmountField) {
            fetchedHistoricalData[dateKey].revenue += amount;
          }
          fetchedHistoricalData[dateKey].count += 1;
        });
        
        Object.entries(fetchedHistoricalData).forEach(([dateKey, values]) => {
          if (!historicalData[dateKey]) {
            historicalData[dateKey] = values;
          } else {
            historicalData[dateKey].revenue += values.revenue;
            historicalData[dateKey].count += values.count;
          }
        });
        
        const manualOrdersInPeriod = MANUAL_ORDERS.filter((o: any) => {
          const orderDate = new Date(o.date);
          return orderDate >= startDateUTC && orderDate <= endDateUTC;
        });
        
        if (manualOrdersInPeriod.length > 0) {
          const manualOrderIdsInPeriod = new Set(manualOrdersInPeriod.map((o: any) => o.id));
          // Tentar buscar com amount_cents, se falhar, buscar sem
          let manualOrdersData: any[] = [];
          const { data: dataWithAmount, error: errorWithAmount } = await supabase
            .from("orders")
            .select("id, amount_cents, created_at")
            .in("id", Array.from(manualOrderIdsInPeriod))
            .eq("status", "paid");
          
          if (errorWithAmount && errorWithAmount.code === '400' && errorWithAmount.message?.includes('column')) {
            // Tentar sem amount_cents
            const { data: dataWithoutAmount } = await supabase
              .from("orders")
              .select("id, created_at")
              .in("id", Array.from(manualOrderIdsInPeriod))
              .eq("status", "paid");
            
            if (dataWithoutAmount) {
              manualOrdersData = dataWithoutAmount;
            }
          } else if (dataWithAmount) {
            manualOrdersData = dataWithAmount;
          }
          
          if (manualOrdersData && manualOrdersData.length > 0) {
            manualOrdersData.forEach(order => {
              const manualOrder = manualOrdersInPeriod.find((mo: any) => mo.id === order.id);
              if (!manualOrder) return;
              
              const dateKey = (manualOrder as any).date;
              
              if (!historicalData[dateKey]) {
                historicalData[dateKey] = { revenue: 0, count: 0 };
              }
              
              // Verificar se amount_cents existe
              if ('amount_cents' in order) {
                const amount = (order.amount_cents || 0) / 100;
                if (!isNaN(amount) && amount > 0) {
                  historicalData[dateKey].revenue += amount;
                }
              }
              historicalData[dateKey].count += 1;
            });
          }
        }
      }
      
      const { year, month, day } = getBrasiliaDate();
      const todayStart = new Date(Date.UTC(year, month - 1, day, 3, 0, 0, 0));
      const todayEnd = new Date(Date.UTC(year, month - 1, day, 26, 59, 59, 999));
      
      let todayData: Record<string, any> = {};
      
      try {
        // Tentar com campos completos primeiro
        let todayFieldsToSelect = "id, status, amount_cents, payment_provider, provider, created_at";
        let { data: todayOrders, error } = await supabase
          .from("orders")
          .select(todayFieldsToSelect)
          .eq("status", "paid")
          .gte("created_at", todayStart.toISOString())
          .lte("created_at", todayEnd.toISOString());
        
        // Se falhar por campos faltantes, tentar sem eles
        if (error && error.code === '400' && error.message?.includes('column')) {
          todayFieldsToSelect = "id, status, payment_provider, provider, created_at";
          const retryQuery = await supabase
            .from("orders")
            .select(todayFieldsToSelect)
            .eq("status", "paid")
            .gte("created_at", todayStart.toISOString())
            .lte("created_at", todayEnd.toISOString());
          
          if (retryQuery.error && retryQuery.error.code === '400' && retryQuery.error.message?.includes('column')) {
            todayFieldsToSelect = "id, status, created_at";
            const retryQuery2 = await supabase
              .from("orders")
              .select(todayFieldsToSelect)
              .eq("status", "paid")
              .gte("created_at", todayStart.toISOString())
              .lte("created_at", todayEnd.toISOString());
            
            todayOrders = retryQuery2.data;
            error = retryQuery2.error;
          } else {
            todayOrders = retryQuery.data;
            error = retryQuery.error;
          }
        }
        
        if (error) {
          const isTableError = error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('relation');
          const isPermissionError = error.code === '42501' || error.message?.includes('permission');
          
          if (isTableError || isPermissionError) {
            // Tabela não existe ou sem permissão, usar dados históricos se disponíveis
            if (Object.keys(historicalData).length === 0) {
              // Se não há dados históricos, retornar dados vazios
              return processSalesDataForCharts({}, period, selectedMonth);
            }
          } else if (process.env.NODE_ENV === 'development') {
            console.error('Erro ao buscar pedidos do dia atual:', error);
          }
        } else if (todayOrders && todayOrders.length > 0) {
          const todayKeyFormatted = todayKey;
          todayData[todayKeyFormatted] = {
            revenue: 0,
            count: 0,
          };
          
          const manualOrderIds = new Set(MANUAL_ORDERS.map((o: any) => o.id));
          
          todayOrders.forEach(order => {
            if (manualOrderIds.has(order.id)) return;
            
            // Verificar se campos existem antes de usar
            const hasAmountField = 'amount_cents' in order;
            
            let amount = 0;
            if (hasAmountField) {
              amount = (order.amount_cents || 0) / 100;
              if (isNaN(amount) || amount <= 0) {
                todayData[todayKeyFormatted].count += 1;
                return;
              }
            }
            
            if (hasAmountField) {
              todayData[todayKeyFormatted].revenue += amount;
            }
            todayData[todayKeyFormatted].count += 1;
          });
          
          const manualOrdersToday = MANUAL_ORDERS.filter((o: any) => o.date === todayKey);
          if (manualOrdersToday.length > 0) {
            const manualOrderIdsToday = new Set(manualOrdersToday.map((o: any) => o.id));
            // Tentar com amount_cents, se falhar, buscar sem
            const { data: manualOrdersDataWithAmount, error: manualError } = await supabase
              .from("orders")
              .select("id, amount_cents")
              .in("id", Array.from(manualOrderIdsToday))
              .eq("status", "paid");
            
            let manualOrdersData: any[] = [];
            if (manualError && manualError.code === '400' && manualError.message?.includes('column')) {
              // Tentar sem amount_cents
              const { data: manualOrdersDataWithoutAmount } = await supabase
                .from("orders")
                .select("id")
                .in("id", Array.from(manualOrderIdsToday))
                .eq("status", "paid");
              
              if (manualOrdersDataWithoutAmount) {
                manualOrdersData = manualOrdersDataWithoutAmount;
              }
            } else if (manualOrdersDataWithAmount) {
              manualOrdersData = manualOrdersDataWithAmount;
            }
            
            if (manualOrdersData && manualOrdersData.length > 0) {
              manualOrdersData.forEach(order => {
                if ('amount_cents' in order) {
                  const amount = (order.amount_cents || 0) / 100;
                  if (!isNaN(amount) && amount > 0) {
                    todayData[todayKeyFormatted].revenue += amount;
                  }
                }
                todayData[todayKeyFormatted].count += 1;
              });
            }
          }
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Erro ao processar pedidos do dia atual:', error);
        }
        // Continuar com dados históricos se disponíveis
      }
      
      const combinedData = { ...historicalData, ...todayData };
      
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(cacheKey, JSON.stringify({
            lastUpdate: todayKey,
            data: combinedData,
          }));
        } catch (e) {
          console.error('Erro ao salvar cache:', e);
          try {
            const ninetyDaysAgo = new Date(today);
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 30);
            
            const cleanedData: Record<string, any> = {};
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
      
      const result = processSalesDataForCharts(combinedData, period, selectedMonth);
      
      return result;
    },
    initialData: initialData,
    placeholderData: (previousData) => previousData || initialData,
    staleTime: 1 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });
}

/**
 * Hook para carregar créditos Suno
 * Cache: 5 minutos
 */
export function useSunoCredits() {
  return useQuery({
    queryKey: queryKeys.dashboard.sunoCredits(),
    queryFn: async () => {
      const defaultValues = {
        total: 0,
        used: 0,
        remaining: 0,
      };
      
      try {
        let { data, error } = await supabase
          .from('suno_credits')
          .select('credits, credits_used')
          .limit(1)
          .maybeSingle();
        
        if (error) {
          const isTableError = error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('relation');
          const isColumnError = error.code === '400' || error.message?.includes('column') || error.message?.includes('PGRST');
          
          if (isTableError) {
            return defaultValues;
          }
          
          if (isColumnError) {
            const { data: data2, error: error2 } = await supabase
              .from('suno_credits')
              .select('*')
              .limit(1)
              .maybeSingle();
            
            if (error2) {
              return defaultValues;
            }
            
            if (data2) {
              data = {
                credits: data2.credits || data2.total_credits || 0,
                credits_used: data2.credits_used || data2.used_credits || 0,
              };
              error = null;
            } else {
              return defaultValues;
            }
          } else {
            return defaultValues;
          }
        }
        
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
        return defaultValues;
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

