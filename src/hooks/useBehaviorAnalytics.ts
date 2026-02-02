import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ClarityMetrics {
  totalVisits: number;
  totalDeadClicks: number;
  totalRageClicks: number;
  totalJsErrors: number;
  averageScrollDepth: number;
  pages: Record<string, {
    visits: number;
    deadClicks: number;
    rageClicks: number;
    jsErrors: number;
  }>;
}

interface HotjarMetrics {
  totalVisits: number;
  totalRecordings: number;
  totalFeedback: number;
  funnelConversions: Record<string, number>;
  pages: Record<string, {
    visits: number;
    recordings: number;
  }>;
}

interface AnalyticsLinks {
  dashboard?: string;
  heatmaps?: string;
  recordings?: string;
  insights?: string;
  errors?: string;
  funnels?: string;
  feedback?: string;
}

interface BehaviorAnalyticsData {
  clarity: {
    success: boolean;
    projectId?: string;
    metrics: ClarityMetrics;
    links: AnalyticsLinks;
    analytics: any[];
  } | null;
  hotjar: {
    success: boolean;
    siteId?: string;
    metrics: HotjarMetrics;
    links: AnalyticsLinks;
    analytics: any[];
  } | null;
}

export function useBehaviorAnalytics() {
  const [data, setData] = useState<BehaviorAnalyticsData>({
    clarity: null,
    hotjar: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Obter token de autenticação
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Usuário não autenticado');
      }

      // Buscar dados do Clarity
      const clarityResponse = await supabase.functions.invoke('clarity-analytics', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (clarityResponse.error) {
        console.error('Erro ao buscar dados do Clarity:', clarityResponse.error);
      }

      // Buscar dados do Hotjar
      const hotjarResponse = await supabase.functions.invoke('hotjar-analytics', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (hotjarResponse.error) {
        console.error('Erro ao buscar dados do Hotjar:', hotjarResponse.error);
      }

      setData({
        clarity: clarityResponse.data || null,
        hotjar: hotjarResponse.data || null,
      });
    } catch (err: any) {
      console.error('Erro ao buscar analytics:', err);
      setError(err.message || 'Erro ao buscar dados de analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics().catch((error) => {
      console.error('❌ [useBehaviorAnalytics] Erro não tratado em fetchAnalytics:', error);
      setError(error?.message || 'Erro ao buscar dados de analytics');
    });
  }, [fetchAnalytics]);

  // Calcular métricas do funil de conversão
  const calculateFunnelMetrics = useCallback(() => {
    if (!data.clarity?.analytics && !data.hotjar?.analytics) {
      return null;
    }

    const allAnalytics = [
      ...(data.clarity?.analytics || []),
      ...(data.hotjar?.analytics || []),
    ];

    // Agrupar por tipo de evento e página
    const funnelSteps = {
      homepage: { views: 0, conversions: 0 },
      quiz: { views: 0, conversions: 0 },
      checkout: { views: 0, conversions: 0 },
      payment_success: { views: 0, conversions: 0 },
    };

    allAnalytics.forEach((item) => {
      if (item.event_type === 'page_view') {
        if (item.page_path === '/' || item.page_path === '/pt' || item.page_path === '/en' || item.page_path === '/es') {
          funnelSteps.homepage.views += item.event_count;
        } else if (item.page_path.includes('/quiz')) {
          funnelSteps.quiz.views += item.event_count;
        } else if (item.page_path.includes('/checkout')) {
          funnelSteps.checkout.views += item.event_count;
        } else if (item.page_path.includes('/payment-success')) {
          funnelSteps.payment_success.views += item.event_count;
        }
      } else if (item.event_type === 'funnel_complete') {
        funnelSteps.payment_success.conversions += item.event_count;
      }
    });

    // Calcular taxas de conversão
    const funnelData = [
      {
        step: 1,
        name: 'Homepage',
        users: funnelSteps.homepage.views,
        conversions: funnelSteps.quiz.views,
        conversionRate: funnelSteps.homepage.views > 0 
          ? (funnelSteps.quiz.views / funnelSteps.homepage.views) * 100 
          : 0,
      },
      {
        step: 2,
        name: 'Quiz',
        users: funnelSteps.quiz.views,
        conversions: funnelSteps.checkout.views,
        conversionRate: funnelSteps.quiz.views > 0 
          ? (funnelSteps.checkout.views / funnelSteps.quiz.views) * 100 
          : 0,
      },
      {
        step: 3,
        name: 'Checkout',
        users: funnelSteps.checkout.views,
        conversions: funnelSteps.payment_success.views,
        conversionRate: funnelSteps.checkout.views > 0 
          ? (funnelSteps.payment_success.views / funnelSteps.checkout.views) * 100 
          : 0,
      },
      {
        step: 4,
        name: 'Pagamento',
        users: funnelSteps.payment_success.views,
        conversions: funnelSteps.payment_success.conversions,
        conversionRate: 100, // Se chegou aqui, completou
      },
    ];

    return funnelData;
  }, [data]);

  return {
    data,
    loading,
    error,
    refetch: fetchAnalytics,
    funnelMetrics: calculateFunnelMetrics(),
  };
}

