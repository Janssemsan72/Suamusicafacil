import { Link, LinkProps } from 'react-router-dom';
import { useUtmParams } from '@/hooks/useUtmParams';
import { useEffect, useRef } from 'react';

/**
 * Componente Link que automaticamente preserva parâmetros UTM
 * Use este componente ao invés de Link do react-router-dom para garantir preservação de UTMs
 * ✅ OTIMIZAÇÃO: Prefetch de rotas quando usuário hover sobre links
 */
export function LinkWithUtms({ to, ...props }: LinkProps & { to: string }) {
  const { utms, getUtmQueryString } = useUtmParams();
  const linkRef = useRef<HTMLAnchorElement>(null);
  const prefetchedRef = useRef(false);

  // ✅ OTIMIZAÇÃO: Prefetch de rotas quando hover
  useEffect(() => {
    const linkElement = linkRef.current;
    if (!linkElement) return;

    const handleMouseEnter = () => {
      if (prefetchedRef.current) return;
      
      // Prefetch do módulo da rota
      const path = to.split('?')[0].split('#')[0]; // Remover query params e hash
      const routePath = path.startsWith('/') ? path : `/${path}`;
      
      // ✅ OTIMIZAÇÃO: Prefetch baseado no caminho da rota
      if (routePath.includes('/quiz') || routePath.endsWith('/quiz')) {
        import('../pages/Quiz').catch(() => {});
      } else if (routePath.includes('/pricing') || routePath.endsWith('/pricing')) {
        import('../pages/Pricing').catch(() => {});
      } else if (routePath.includes('/terms') || routePath.endsWith('/terms')) {
        import('../pages/Terms').catch(() => {});
      } else if (routePath.includes('/privacy') || routePath.endsWith('/privacy')) {
        import('../pages/Privacy').catch(() => {});
      }
      
      prefetchedRef.current = true;
    };

    linkElement.addEventListener('mouseenter', handleMouseEnter, { passive: true });
    
    return () => {
      linkElement.removeEventListener('mouseenter', handleMouseEnter);
    };
  }, [to]);

  // Se não há UTMs, usar Link normal
  if (Object.keys(utms).length === 0) {
    return <Link to={to} ref={linkRef} {...props} />;
  }

  // Adicionar UTMs ao link
  const utmQuery = getUtmQueryString(false); // Não incluir params existentes (vamos mesclar manualmente)
  const url = new URL(to, window.location.origin);
  
  // Preservar query params existentes no 'to'
  const existingParams = new URLSearchParams(url.search);
  
  // Adicionar UTMs
  Object.entries(utms).forEach(([key, value]) => {
    if (value && !existingParams.has(key)) {
      existingParams.set(key, value as string);
    }
  });

  // ✅ CORREÇÃO: Ordem correta: pathname → ?search params (UTMs) → #hash
  const hash = url.hash || '';
  const finalTo = url.pathname + (existingParams.toString() ? `?${existingParams.toString()}` : '') + hash;

  return <Link to={finalTo} ref={linkRef} {...props} />;
}

