import { useState, useEffect } from 'react';

interface RegionalPricing {
  region: string;
  country: string;
  language: string;
  pricing: Array<{
    id: string;
    plan_name: string;
    price_cents: number;
    currency: string;
    features: string[];
    is_active: boolean;
  }>;
  session_token: string;
  expires_at: string;
}

interface UseRegionalPricingReturn {
  pricing: RegionalPricing | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  formatPrice: (cents: number, currency: string) => string;
  getRegionFlag: (country: string) => string;
  getRegionName: (region: string) => string;
}

export function useRegionalPricing(): UseRegionalPricingReturn {
  const [pricing, setPricing] = useState<RegionalPricing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRegionalPricing = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Verificar se há session_token salvo
      const sessionToken = localStorage.getItem('pricing_session_token');
      
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await supabase.functions.invoke('get-regional-pricing', {
        body: { session_token: sessionToken }
      });

      if (error) throw error;

      // Salvar session token
      localStorage.setItem('pricing_session_token', data.session_token);
      setPricing(data);
      
      console.log('✅ Preços regionais carregados:', data);
    } catch (error: any) {
      console.error('❌ Erro ao carregar preços:', error);
      setError(error.message || 'Erro ao carregar preços');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (cents: number, currency: string) => {
    const value = cents / 100;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency
    }).format(value);
  };

  const getRegionFlag = (country: string) => {
    const flags: Record<string, string> = {
      'BR': '🇧🇷',
      'US': '🇺🇸',
      'ES': '🇪🇸',
      'MX': '🇲🇽',
      'AR': '🇦🇷',
      'CO': '🇨🇴',
      'CL': '🇨🇱',
      'PE': '🇵🇪',
      'OTHER': '🌍'
    };
    return flags[country] || '🌍';
  };

  const getRegionName = (region: string) => {
    const names: Record<string, string> = {
      'brasil': 'Brasil',
      'usa': 'Estados Unidos',
      'internacional': 'Internacional'
    };
    return names[region] || region;
  };

  useEffect(() => {
    loadRegionalPricing();
  }, []);

  return {
    pricing,
    loading,
    error,
    refetch: loadRegionalPricing,
    formatPrice,
    getRegionFlag,
    getRegionName
  };
}
