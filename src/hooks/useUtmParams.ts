import { useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';

/**
 * Hook para capturar, salvar e preservar parâmetros UTM através do funil
 * Mantém UTMs em localStorage e injeta em todas as navegações
 */
export function useUtmParams() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  // ✅ Verificar se está em rota administrativa - não capturar nem preservar UTMs
  const isAdminRoute = location.pathname.startsWith('/admin') || 
                       location.pathname.startsWith('/app/admin');

  // Parâmetros de tracking completos (UTMs + Google Ads + Facebook + outros)
  const TRACKING_PARAMS = [
    // UTMs padrão
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    // Google Ads
    'gclid', 'gclsrc', 'gad_source', 'gad_campaignid', 'gbraid',
    // Google Analytics
    '_ga', '_gid',
    // Facebook
    'fbclid', 'fb_action_ids', 'fb_action_types',
    // Microsoft/Bing
    'msclkid',
    // Google Ads HSA (Historical Search Ads)
    'hsa_acc', 'hsa_cam', 'hsa_grp', 'hsa_ad', 'hsa_src', 'hsa_tgt', 'hsa_kw', 'hsa_mt', 'hsa_net', 'hsa_ver',
    // Outros parâmetros de tracking
    'ref', 'source', 'sck', 'xcod', 'network',
    // Google Analytics Campaign
    '_gac',
  ];

  // Capturar TODOS os parâmetros de tracking da URL atual
  const currentTrackingParams = useMemo(() => {
    if (isAdminRoute) {
      return {};
    }
    const params: Record<string, string> = {};
    TRACKING_PARAMS.forEach(param => {
      const value = searchParams.get(param);
      if (value) {
        params[param] = value;
      }
    });
    
    // Também capturar parâmetros _gac_* (Google Analytics Campaign com formato _gac_GA_MEASUREMENT_ID__CAMPAIGN_ID__TIMESTAMP)
    searchParams.forEach((value, key) => {
      if (key.startsWith('_gac_') && !params[key]) {
        params[key] = value;
      }
    });
    
    return params;
  }, [isAdminRoute, searchParams]);

  // UTMs padrão (para compatibilidade)
  const currentUtms = useMemo(() => {
    const utms: Record<string, string> = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(param => {
      if (currentTrackingParams[param]) {
        utms[param] = currentTrackingParams[param];
      }
    });
    return utms;
  }, [currentTrackingParams]);

  // Salvar TODOS os parâmetros de tracking no localStorage quando detectados
  useEffect(() => {
    if (isAdminRoute) {
      return;
    }
    if (Object.keys(currentTrackingParams).length > 0) {
      localStorage.setItem('musiclovely_tracking_params', JSON.stringify(currentTrackingParams));
    }
  }, [currentTrackingParams, isAdminRoute]);

  // Carregar parâmetros de tracking salvos do localStorage
  const savedTrackingParams = useMemo(() => {
    if (isAdminRoute) {
      return {};
    }
    try {
      const saved = localStorage.getItem('musiclovely_tracking_params');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  }, [isAdminRoute]);

  // Parâmetros de tracking finais: mesclar URL atual + localStorage (URL atual tem prioridade)
  const allTrackingParams = useMemo(() => {
    // Sempre mesclar: parâmetros da URL atual + parâmetros salvos
    const merged = { ...savedTrackingParams, ...currentTrackingParams };
    return merged;
  }, [currentTrackingParams, savedTrackingParams]);

  // UTMs padrão (para compatibilidade com código existente)
  const utms = useMemo(() => {
    const utms: Record<string, string> = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(param => {
      if (allTrackingParams[param]) {
        utms[param] = allTrackingParams[param];
      }
    });
    return utms;
  }, [allTrackingParams]);

  // Salvar parâmetros mesclados no localStorage sempre que mudarem
  useEffect(() => {
    if (isAdminRoute) {
      return;
    }
    if (Object.keys(allTrackingParams).length > 0) {
      localStorage.setItem('musiclovely_tracking_params', JSON.stringify(allTrackingParams));
    }
  }, [allTrackingParams, isAdminRoute]);

  // Injeção de UTMs na URL desabilitada - manter apenas leitura e salvamento no localStorage para uso interno
  // useEffect(() => {
  //   if (Object.keys(savedTrackingParams).length > 0 && Object.keys(currentTrackingParams).length === 0) {
  //     const currentParams = new URLSearchParams(location.search);
  //     let needsUpdate = false;
  //     Object.entries(savedTrackingParams).forEach(([key, value]) => {
  //       if (value && !currentParams.has(key)) {
  //         needsUpdate = true;
  //         currentParams.set(key, value as string);
  //       }
  //     });
  //     if (needsUpdate) {
  //       const newSearch = currentParams.toString();
  //       const newUrl = location.pathname + (newSearch ? `?${newSearch}` : '') + (location.hash || '');
  //       window.history.replaceState({}, '', newUrl);
  //     }
  //   }
  // }, [location.pathname, location.search, savedTrackingParams, currentTrackingParams]);

  /**
   * Função helper para navegar preservando TODOS os parâmetros de tracking
   */
  const navigateWithUtms = (path: string, options?: { replace?: boolean; state?: unknown }) => {
    if (isAdminRoute) {
      navigate(path, options);
      return;
    }
    try {
      // ✅ CORREÇÃO: Garantir que o path comece com /
      const normalizedPath = path.startsWith('/') ? path : `/${path}`;
      
      // ✅ CORREÇÃO: Usar URL apenas se o path contiver protocolo ou for uma URL completa
      // Caso contrário, tratar como path relativo
      let url: URL;
      try {
        url = new URL(normalizedPath, window.location.origin);
      } catch (urlError) {
        // Se falhar, tratar como path simples
        const pathParts = normalizedPath.split('?');
        const pathname = pathParts[0];
        const search = pathParts[1] || '';
        const hashMatch = normalizedPath.match(/#(.+)$/);
        const hash = hashMatch ? `#${hashMatch[1]}` : '';
        
        const existingParams = new URLSearchParams(search);
        
        // Adicionar/substituir TODOS os parâmetros de tracking na URL
        Object.entries(allTrackingParams).forEach(([key, value]) => {
          if (value) {
            existingParams.set(key, value as string);
          }
        });
        
        const finalPath = pathname + (existingParams.toString() ? `?${existingParams.toString()}` : '') + hash;
        navigate(finalPath, options);
        return;
      }
      
      // Preservar parâmetros existentes na URL
      const existingParams = new URLSearchParams(url.search);
      
      // Adicionar/substituir TODOS os parâmetros de tracking na URL
      Object.entries(allTrackingParams).forEach(([key, value]) => {
        if (value) {
          existingParams.set(key, value as string);
        }
      });

      // ✅ CORREÇÃO: Ordem correta: pathname → ?search params (UTMs) → #hash
      // Preservar hash se existir no path original
      const hash = url.hash || '';
      const finalPath = url.pathname + (existingParams.toString() ? `?${existingParams.toString()}` : '') + hash;
      navigate(finalPath, options);
    } catch (error) {
      // Fallback: tentar navegação simples sem UTMs
      try {
        navigate(path, options);
      } catch (fallbackError) {
      }
    }
  };

  /**
   * Função para obter query string com TODOS os parâmetros de tracking
   */
  const getUtmQueryString = (includeExisting = true): string => {
    if (isAdminRoute) {
      return '';
    }
    // Se não há parâmetros de tracking, retornar string vazia
    if (Object.keys(allTrackingParams).length === 0) {
      return '';
    }
    
    const params = new URLSearchParams();
    
    if (includeExisting) {
      // Incluir parâmetros existentes na URL atual
      searchParams.forEach((value, key) => {
        params.set(key, value);
      });
    }
    
    // Adicionar TODOS os parâmetros de tracking salvos (se não já estiverem presentes)
    Object.entries(allTrackingParams).forEach(([key, value]) => {
      if (value && !params.has(key)) {
        params.set(key, value as string);
      }
    });

    const queryString = params.toString();
    
    if (!queryString) {
      return '';
    }
    
    // Se includeExisting é false e já temos params na URL atual, usar & ao invés de ?
    if (!includeExisting && searchParams.toString()) {
      // Retornar apenas os parâmetros novos com &
      const newParams = new URLSearchParams();
      Object.entries(allTrackingParams).forEach(([key, value]) => {
        if (value && !searchParams.has(key)) {
          newParams.set(key, value as string);
        }
      });
      const newParamsString = newParams.toString();
      return newParamsString ? `&${newParamsString}` : '';
    }
    
    return `?${queryString}`;
  };

  /**
   * Limpar parâmetros de tracking salvos (útil para testes ou reset)
   */
  const clearUtms = () => {
    localStorage.removeItem('musiclovely_tracking_params');
    localStorage.removeItem('musiclovely_utms'); // Manter compatibilidade
  };

  return {
    utms, // UTMs padrão (para compatibilidade)
    allTrackingParams, // TODOS os parâmetros de tracking
    currentUtms, // UTMs da URL atual (para compatibilidade)
    currentTrackingParams, // Todos os parâmetros da URL atual
    savedUtms: utms, // Para compatibilidade
    savedTrackingParams, // Todos os parâmetros salvos
    hasUtms: Object.keys(utms).length > 0,
    hasTrackingParams: Object.keys(allTrackingParams).length > 0,
    navigateWithUtms,
    getUtmQueryString,
    clearUtms,
  };
}

