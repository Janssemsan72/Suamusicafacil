import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';

/**
 * Hook para carregar planos de preços (dados estáticos)
 * Cache infinito - os dados raramente mudam
 */
export function usePricingPlans() {
  return useQuery({
    queryKey: queryKeys.static.pricing(),
    queryFn: async () => {
      console.log('🔄 [useStaticData] Carregando planos de preços...');
      
      const { data, error } = await supabase
        .from('pricing_plans')
        .select('*')
        .order('price', { ascending: true });
      
      if (error) throw error;
      
      console.log('✅ [useStaticData] Planos carregados (cache infinito)');
      
      return data || [];
    },
    staleTime: Infinity, // Nunca fica stale
    gcTime: Infinity, // Nunca é removido do cache
  });
}

/**
 * Hook para carregar templates de email (dados estáticos)
 * Cache infinito
 */
export function useEmailTemplates() {
  return useQuery({
    queryKey: queryKeys.static.emailTemplates(),
    queryFn: async () => {
      console.log('🔄 [useStaticData] Carregando templates de email...');
      
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      console.log('✅ [useStaticData] Templates carregados (cache infinito)');
      
      return data || [];
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

/**
 * Hook para carregar configurações do sistema (dados estáticos)
 * Cache infinito
 */
export function useSystemSettings() {
  return useQuery({
    queryKey: queryKeys.static.settings(),
    queryFn: async () => {
      console.log('🔄 [useStaticData] Carregando configurações do sistema...');
      
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      
      console.log('✅ [useStaticData] Configurações carregadas (cache infinito)');
      
      return data || {};
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

/**
 * Hook genérico para dados estáticos com cache infinito
 */
export function useStaticCache<T>(
  key: string,
  fetcher: () => Promise<T>
) {
  return useQuery({
    queryKey: [...queryKeys.static.all, key],
    queryFn: async () => {
      console.log(`🔄 [useStaticData] Carregando ${key}...`);
      const data = await fetcher();
      console.log(`✅ [useStaticData] ${key} carregado (cache infinito)`);
      return data;
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });
}














