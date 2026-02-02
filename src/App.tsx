// Force rebuild: 2025-10-21 - Fix edge functions deployment
import { Suspense, lazy, useEffect, useState, useMemo } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
// ✅ OTIMIZAÇÃO: initCacheSystem será lazy loaded
import { BrowserRouter, useLocation } from "react-router-dom";
import { LocaleProvider } from "@/contexts/LocaleContext";
import { devLog } from "@/utils/devLogger";
import { scheduleNonCriticalRender } from "@/utils/scheduleNonCriticalRender";
import { AppRoutes } from "@/routes/AppRoutes";
import { PublicErrorBoundary } from "@/components/PublicErrorBoundary";
import ScrollRestoration from "@/components/ScrollRestoration";
import ScrollToTop from "@/components/ScrollToTop";

const LazyToaster = lazy(() => import("@/components/ui/sonner").then((m) => ({ default: m.Toaster })));
const LazyTooltipProvider = lazy(() =>
  import("@/components/ui/tooltip").then((m) => ({ default: m.TooltipProvider }))
);

const App = () => {
  // ✅ OTIMIZAÇÃO: Lazy load do cache system - não bloquear renderização inicial
  useEffect(() => {
    return scheduleNonCriticalRender(() => {
      (async () => {
        try {
          const { initCacheSystem } = await import('@/lib/queryClient');
          await initCacheSystem();
        } catch (error) {
          console.error('❌ [App] Erro ao inicializar sistema de cache:', error);
        }
      })();
    }, { timeoutMs: 5000, delayMs: 2000 });
  }, []);

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <QueryClientProvider client={queryClient}>
        <LocaleProvider>
          <AppContent />
        </LocaleProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
};

const AppContent = () => {
  // Site é 100% espanhol - sem lógica de loading de locale
  const location = useLocation();
  const [shouldRenderNonCritical, setShouldRenderNonCritical] = useState(false);
  
  // ✅ OTIMIZAÇÃO: Defer devLog.debug para não bloquear renderização inicial
  useEffect(() => {
    return scheduleNonCriticalRender(() => {
      devLog.debug('[App] AppContent renderizando...', {
        pathname: typeof window !== 'undefined' ? window.location.pathname : location.pathname,
        timestamp: new Date().toISOString()
      });
    }, { timeoutMs: 3000, delayMs: 500 });
  }, [location.pathname]);

  useEffect(() => {
    return scheduleNonCriticalRender(() => setShouldRenderNonCritical(true), {
      timeoutMs: 1500,
      delayMs: 800,
    });
  }, []);
  
  // ✅ OTIMIZAÇÃO: Memoizar content para evitar re-renders desnecessários quando shouldRenderNonCritical mudar
  const content = useMemo(() => (
    <>
      <ScrollToTop />
      <ScrollRestoration />
      <PublicErrorBoundary>
        <AppRoutes />
      </PublicErrorBoundary>
    </>
  ), []); // Roteamento é gerenciado internamente pelo RouterProvider/Context

  // Renderização progressiva para não bloquear LCP
  return (
    <>
      {shouldRenderNonCritical ? (
        <Suspense fallback={content}>
          <LazyTooltipProvider>{content}</LazyTooltipProvider>
          <Suspense fallback={null}>
            <LazyToaster />
          </Suspense>
        </Suspense>
      ) : (
        content
      )}
    </>
  );
};

export default App;
