import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useSmoothScroll } from './use-smooth-scroll';

/**
 * Hook que automaticamente faz scroll para o topo da página
 * quando a rota muda
 */
export const useScrollToTop = () => {
  const location = useLocation();
  const { scrollToTop } = useSmoothScroll();
  const lastPathnameRef = useRef<string>(''); // ✅ FASE 4: Ref para rastrear último pathname

  useEffect(() => {
    // ✅ FASE 4: Verificar se pathname mudou antes de executar scroll
    if (lastPathnameRef.current === location.pathname) {
      return;
    }
    lastPathnameRef.current = location.pathname;
    
    // Scroll para o topo sempre que a rota mudar
    scrollToTop();
    // ✅ FASE 4: scrollToTop já está memoizado em useSmoothScroll, não precisa na dependência
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);
};

/**
 * Hook que faz scroll para o topo quando um componente é montado
 */
export const useScrollToTopOnMount = () => {
  const { scrollToTop } = useSmoothScroll();

  useEffect(() => {
    scrollToTop();
  }, [scrollToTop]);
};
