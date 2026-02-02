import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Componente que posiciona a página no topo em rotas específicas
 * Executa apenas uma vez quando a rota muda
 */
export default function ScrollRestoration() {
  const location = useLocation();
  const lastPathnameRef = useRef<string>('');

  // Lista de rotas que devem iniciar no topo
  const scrollToTopRoutes = [
    '/terms',
    '/privacy',
    '/pricing',
    '/about',
    '/company',
    '/how-it-works',
    '/quiz',
    '/pt/terms',
    '/pt/privacy',
    '/pt/pricing',
    '/pt/about',
    '/pt/company',
    '/pt/how-it-works',
    '/pt/quiz',
    '/en/terms',
    '/en/privacy',
    '/en/pricing',
    '/en/about',
    '/en/company',
    '/en/how-it-works',
    '/en/quiz',
    '/es/terms',
    '/es/privacy',
    '/es/pricing',
    '/es/about',
    '/es/company',
    '/es/how-it-works',
    '/es/quiz'
  ];

  useEffect(() => {
    const currentPath = location.pathname;
    
    // Verificar se pathname mudou
    if (lastPathnameRef.current === currentPath) {
      return;
    }
    lastPathnameRef.current = currentPath;
    
    // Verificar se a rota atual está na lista
    const shouldScrollToTop = scrollToTopRoutes.includes(currentPath);
    
    if (!shouldScrollToTop) {
      return;
    }

    // Verificar se há hash na URL (ex: /terms#section)
    if (location.hash) {
      return;
    }

    // ✅ OTIMIZAÇÃO CRÍTICA: Evitar forced reflow - usar requestAnimationFrame para batch de leituras/escritas
    // Função para forçar scroll no topo (otimizada para evitar reflows)
    const forceScrollToTop = () => {
      // ✅ OTIMIZAÇÃO: Ler propriedades de layout apenas uma vez por frame
      requestAnimationFrame(() => {
        // Verificar se há container customizado (apenas para Index)
        const scrollContainer = document.getElementById('main-scroll-container');
        
        if (scrollContainer) {
          // Para páginas com container customizado (Index)
          scrollContainer.scrollTop = 0;
        } else {
          // Para páginas normais (Terms, Privacy, etc)
          // Usar behavior: 'auto' para scroll instantâneo
          window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
          document.documentElement.scrollTop = 0;
          if (document.body) {
            document.body.scrollTop = 0;
          }
        }
      });
    };
    
    // ✅ OTIMIZAÇÃO: Executar após o DOM estar pronto, mas evitar múltiplos reflows
    requestAnimationFrame(() => {
      forceScrollToTop();
      
      // Executar novamente após um delay para garantir que lazy loading completou
      setTimeout(() => {
        forceScrollToTop();
      }, 100);
      
      // Executar uma última vez após um delay maior para garantir que tudo está renderizado
      setTimeout(() => {
        forceScrollToTop();
      }, 300);
    });
    
    return () => {
      // Cleanup não necessário, mas mantido para consistência
    };
  }, [location.pathname, location.hash]);

  return null;
}
