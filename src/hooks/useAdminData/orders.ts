import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys, queryClient } from '@/lib/queryClient';
import { countOrdersPaginated, fetchRevenuePaginated, isHotmartOrder } from './utils';

/**
 * Hook para carregar pedidos com filtros e paginação otimizada
 * Carrega apenas campos necessários para melhor performance
 * Cache: 3 minutos
 */
export function useOrders(filters?: {
  search?: string;
  status?: string;
  plan?: string;
  provider?: string;
  page?: number;
  pageSize?: number;
}) {
  const usePagination = filters?.page !== undefined && filters?.pageSize !== undefined;
  const page = filters?.page && filters.page > 0 ? filters.page : 1;
  const pageSize = filters?.pageSize && filters.pageSize > 0 ? filters.pageSize : 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  return useQuery({
    queryKey: queryKeys.orders.list(filters),
    queryFn: async () => {
      try {
        let baseQuery = supabase
          .from("orders")
          .select("id, customer_email, status, plan, created_at")
          .order("created_at", { ascending: false });

        if (filters?.status && filters.status !== 'all') {
          baseQuery = baseQuery.eq('status', filters.status);
        }
        if (filters?.plan && filters.plan !== 'all') {
          baseQuery = baseQuery.eq('plan', filters.plan);
        }

        let allOrders: any[] = [];

        if (filters?.search) {
          const searchTerm = filters.search.trim();
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(searchTerm);

          if (isUUID) {
            const { data, error } = await baseQuery.eq('id', searchTerm).limit(1);
            if (error) throw error;
            allOrders = data || [];
          } else {
            const phoneSearchTerm = searchTerm.replace(/[\s\-\(\)\+]/g, '');
            const { data: emailData, error: emailError } = await supabase
              .from("orders")
              .select("id, customer_email, status, plan, created_at")
              .ilike('customer_email', `%${searchTerm}%`)
              .order("created_at", { ascending: false });

            if (emailError) console.error('Erro ao buscar por email:', emailError);

            let phoneData: any[] = [];
            try {
              const { data, error: phoneError } = await supabase
                .from("orders")
                .select("id, customer_email, status, plan, created_at")
                .ilike('customer_whatsapp', `%${phoneSearchTerm}%`)
                .order("created_at", { ascending: false });
              if (!phoneError) phoneData = data || [];
            } catch {
              console.warn('Campo customer_whatsapp não acessível');
            }

            const combinedResults = new Map();
            (emailData || []).forEach((o: any) => combinedResults.set(o.id, o));
            (phoneData || []).forEach((o: any) => combinedResults.set(o.id, o));
            allOrders = Array.from(combinedResults.values());

            if (filters?.status && filters.status !== 'all') {
              allOrders = allOrders.filter(o => o.status === filters.status);
            }
            if (filters?.plan && filters.plan !== 'all') {
              allOrders = allOrders.filter(o => o.plan === filters.plan);
            }

            return { orders: allOrders, total: allOrders.length };
          }
        } else {
          if (!usePagination) {
            let allData: any[] = [];
            let offset = 0;
            const pageSizeInternal = 1000;
            let hasMore = true;

            while (hasMore) {
              const { data, error } = await baseQuery.range(offset, offset + pageSizeInternal - 1);

              if (error) {
                const isTableError = error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('relation');
                const isPermissionError = error.code === '42501' || error.message?.includes('permission');
                if (isTableError) return { orders: [], total: 0 };
                if (isPermissionError) return { orders: [], total: 0 };
                console.warn(`Erro ao carregar pedidos (página ${offset / pageSizeInternal + 1}):`, error);
                break;
              }

              if (data && data.length > 0) {
                allData = allData.concat(data);
                offset += pageSizeInternal;
                hasMore = data.length === pageSizeInternal;
              } else {
                hasMore = false;
              }
            }

            return { orders: allData, total: allData.length };
          } else {
            let countQuery = supabase.from("orders").select("id", { count: 'exact', head: true });
            if (filters?.status && filters.status !== 'all') countQuery = countQuery.eq('status', filters.status);
            if (filters?.plan && filters.plan !== 'all') countQuery = countQuery.eq('plan', filters.plan);

            const [dataResult, countResult] = await Promise.all([
              baseQuery.range(from, to),
              countQuery
            ]);

            if (dataResult.error) {
              const isTableError = dataResult.error.code === '42P01' || dataResult.error.message?.includes('does not exist');
              const isPermissionError = dataResult.error.code === '42501' || dataResult.error.message?.includes('permission');
              if (isTableError || isPermissionError) return { orders: [], total: 0 };
              console.warn('Erro ao carregar pedidos paginados:', dataResult.error);
              return { orders: [], total: 0 };
            }

            allOrders = dataResult.data || [];
            const totalCount = countResult.count ?? allOrders.length;
            return { orders: allOrders, total: totalCount };
          }
        }
      } catch (error: any) {
        console.error('Erro ao carregar pedidos:', error);
        return { orders: [], total: 0 };
      }
    },
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchInterval: false,
    retry: (failureCount, error: any) => {
      if (error?.code === '400' || error?.code === '404' || error?.code === '42P01' || error?.code === '42501') return false;
      return failureCount < 1;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000),
  });
}

/**
 * Hook para buscar estatísticas agregadas de pedidos (contagens e somas)
 * Usa count: 'exact' e agregações - não carrega dados completos
 * Cache: 5 minutos
 */
export function useOrdersStats(filters?: {
  search?: string;
  status?: string;
  plan?: string;
  provider?: string;
}) {
  const hasFilters = filters?.search ||
    (filters?.status && filters.status !== 'all') ||
    (filters?.plan && filters.plan !== 'all') ||
    (filters?.provider && filters.provider !== 'all');

  return useQuery({
    queryKey: queryKeys.orders.stats(filters),
    queryFn: async () => {
      if (!hasFilters) {
        try {
          const cachedData = queryClient.getQueryData(queryKeys.dashboard.stats());
          if (cachedData && typeof cachedData === 'object') {
            const dashboard = cachedData as any;
            const pending = Math.max(0, (dashboard.totalOrders || 0) - (dashboard.paidOrders || 0));
            return {
              total: dashboard.totalOrders || 0,
              paid: dashboard.paidOrders || 0,
              totalPaid: dashboard.totalRevenueBRLConverted || 0,
              pending,
              conversionRate: dashboard.totalOrders > 0
                ? ((dashboard.paidOrders || 0) / dashboard.totalOrders) * 100
                : 0
            };
          }
        } catch {}
      }

      if (filters?.search && filters.search.trim()) {
        const searchTerm = filters.search.trim();
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(searchTerm);
        const phoneSearchTerm = searchTerm.replace(/[\s\-\(\)\+]/g, '');

        let allOrderIds: string[] = [];
        if (isUUID) {
          const { data } = await supabase.from("orders").select("id, status, amount_cents").eq('id', searchTerm).limit(1);
          if (data && data.length > 0) allOrderIds = [data[0].id];
        } else {
          const { data: emailData } = await supabase.from("orders").select("id, status, amount_cents").ilike('customer_email', `%${searchTerm}%`).limit(10000);
          const { data: phoneData } = await supabase.from("orders").select("id, status, amount_cents").ilike('customer_whatsapp', `%${phoneSearchTerm}%`).limit(10000);
          const combinedMap = new Map();
          (emailData || []).forEach((o: any) => combinedMap.set(o.id, o));
          (phoneData || []).forEach((o: any) => combinedMap.set(o.id, o));
          allOrderIds = Array.from(combinedMap.keys());
        }

        if (allOrderIds.length > 0) {
          let query = supabase.from("orders").select("id, status, plan, payment_provider, amount_cents").in('id', allOrderIds);
          if (filters?.status && filters.status !== 'all') query = query.eq('status', filters.status);
          if (filters?.plan && filters.plan !== 'all') query = query.eq('plan', filters.plan);
          if (filters?.provider && filters.provider !== 'all') query = query.eq('payment_provider', filters.provider);

          const { data: filteredData } = await query;
          if (filteredData) {
            const total = filteredData.length;
            const paid = filteredData.filter(o => o.status === 'paid');
            const totalPaid = paid.reduce((sum, o) => sum + (o.amount_cents || 0), 0) / 100;
            const pending = filteredData.filter(o => o.status === 'pending').length;
            const conversionRate = total > 0 ? (paid.length / total) * 100 : 0;
            return { total, paid: paid.length, totalPaid, pending, conversionRate };
          }
        }
        return { total: 0, paid: 0, totalPaid: 0, pending: 0, conversionRate: 0 };
      }

      let total = 0, paid = 0, pending = 0;
      const baseFilters = {
        status: filters?.status !== 'all' ? filters?.status : undefined,
        provider: filters?.provider === 'hotmart' ? 'hotmart' as const : undefined,
        plan: filters?.plan !== 'all' ? filters?.plan : undefined
      };

      try {
        total = await countOrdersPaginated(baseFilters);
        paid = await countOrdersPaginated({ ...baseFilters, status: 'paid' });
        pending = await countOrdersPaginated({ ...baseFilters, status: 'pending' });
      } catch (error) {
        console.error('Erro ao contar pedidos:', error);
        total = await countOrdersPaginated(baseFilters);
        paid = await countOrdersPaginated({ ...baseFilters, status: 'paid' });
        pending = await countOrdersPaginated({ ...baseFilters, status: 'pending' });
      }

      let totalPaid = 0;
      if (paid > 0) {
        const hasPlanFilter = filters?.plan && filters.plan !== 'all';
        const hasProviderFilter = filters?.provider && filters.provider !== 'all';

        if (hasProviderFilter && filters?.provider !== 'hotmart') {
          totalPaid = 0;
        } else if (!hasPlanFilter) {
          totalPaid = await fetchRevenuePaginated({ provider: 'hotmart' });
        } else {
          let offset = 0;
          const pageSize = 1000;
          let hasMore = true;
          let totalCents = 0;

          while (hasMore) {
            let query = supabase.from("orders").select("amount_cents, payment_provider, provider").eq('status', 'paid').order("created_at", { ascending: false });
            if (filters?.plan && filters.plan !== 'all') query = query.eq('plan', filters.plan);
            const { data, error } = await query.range(offset, offset + pageSize - 1);

            if (error) break;
            if (!data || data.length === 0) break;

            const hotmartData = data.filter(isHotmartOrder);
            totalCents += hotmartData.reduce((sum, o) => sum + (o.amount_cents || 0), 0);
            offset += pageSize;
            hasMore = data.length === pageSize;
          }
          totalPaid = totalCents / 100;
        }
      }

      const conversionRate = total > 0 ? (paid / total) * 100 : 0;
      return { total, paid, totalPaid, pending, conversionRate };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: (previousData) => previousData,
    retry: (failureCount, error: any) => {
      if (error?.code === '400' || error?.code === '404' || error?.code === '42P01' || error?.code === '42501') return false;
      return failureCount < 1;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000),
  });
}
