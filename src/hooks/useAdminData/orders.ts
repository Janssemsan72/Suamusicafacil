import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys, queryClient } from '@/lib/queryClient';
import { countOrdersPaginated, fetchRevenuePaginated } from './utils';

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
        const listFields = "id, customer_email, status, plan, created_at, payment_provider, provider, is_test_order";
        let baseQuery = supabase
          .from("orders")
          .select(listFields)
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
            const maxRecords = 50000;
            let hasMore = true;

            while (hasMore && allData.length < maxRecords) {
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
              if (isTableError || isPermissionError) {
                const err = new Error(dataResult.error.message || 'Acesso negado ou tabela não encontrada');
                (err as any).code = dataResult.error.code;
                throw err;
              }
              const isColumnError = dataResult.error.code === '400' && (dataResult.error.message?.includes('column') || dataResult.error.message?.includes('PGRST'));
              if (isColumnError) {
                let fallbackQuery = supabase
                  .from("orders")
                  .select("id, customer_email, status, created_at")
                  .order("created_at", { ascending: false });
                if (filters?.status && filters.status !== 'all') fallbackQuery = fallbackQuery.eq('status', filters.status);
                const { data: fallbackData, error: fallbackError } = await fallbackQuery.range(from, to);
                if (!fallbackError && fallbackData) {
                  allOrders = (fallbackData as any[]).map((o) => ({ ...o, plan: null }));
                  return { orders: allOrders, total: countResult?.count ?? allOrders.length };
                }
              }
              const apiErr = new Error(dataResult.error.message || 'Erro ao carregar lista de pedidos');
              (apiErr as any).code = dataResult.error.code;
              throw apiErr;
            }

            allOrders = dataResult.data || [];
            const totalCount = countResult?.count ?? allOrders.length;
            return { orders: allOrders, total: totalCount };
          }
        }
      } catch (error: any) {
        console.error('Erro ao carregar pedidos:', error);
        const msg = error?.message ?? String(error);
        const code = error?.code ?? error?.status;
        throw new Error(code ? `[${code}] ${msg}` : msg);
      }
    },
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: true,
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
      // Não usar cache do dashboard: estatísticas devem vir da mesma fonte que a lista de pedidos,
      // para evitar cards com totais corretos e lista vazia (ex.: RLS ou coluna faltando).

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
      const providerFilter = filters?.provider === 'hotmart' ? 'hotmart' as const
        : filters?.provider === 'cakto' ? 'cakto' as const
        : undefined;
      const baseFilters = {
        status: filters?.status !== 'all' ? filters?.status : undefined,
        provider: providerFilter,
        plan: filters?.plan !== 'all' ? filters?.plan : undefined
      };

      try {
        total = await countOrdersPaginated(baseFilters);
        paid = await countOrdersPaginated({ ...baseFilters, status: 'paid' });
        pending = await countOrdersPaginated({ ...baseFilters, status: 'pending' });
      } catch (error) {
        console.error('Erro ao contar pedidos:', error);
        total = 0;
        paid = 0;
        pending = 0;
      }

      let totalPaid = 0;
      if (paid > 0) {
        const hasPlanFilter = filters?.plan && filters.plan !== 'all';

        if (!hasPlanFilter) {
          totalPaid = await fetchRevenuePaginated();
        } else {
          totalPaid = await fetchRevenuePaginated({ plan: filters!.plan! });
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
