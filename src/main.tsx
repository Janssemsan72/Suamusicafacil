import "./index.css";
import { scheduleNonCriticalRender, scheduleOnFirstInteraction } from "./utils/scheduleNonCriticalRender";
import { initializeReact } from "./utils/initializeReact";
import { setupQuizBeaconSave } from "./utils/quizBeaconSave";

// ✅ Declarar tipos para propriedades globais do window
declare global {
  interface Window {
    __REACT_READY__?: boolean;
    __DEV_METRICS__?: Array<{
      event: string;
      timestamp: number;
      data?: unknown;
      location?: string;
    }>;
    fbq?: {
      (...args: any[]): void;
      q: any[][];
      l: number;
      queue: any[][];
    };
  }
}

function preloadInitialRouteChunks() {
  if (typeof window === 'undefined') return;

  const basePath =
    window.location.pathname.replace(/^\/(pt|en|es)(?=\/|$)/, '') || '/';

  if (basePath === '/pricing') {
    import('./pages/Pricing');
    return;
  }

  if (basePath === '/terms') {
    import('./pages/Terms');
    return;
  }

  // ✅ OTIMIZAÇÃO: Na home, prefetch do chunk Quiz após load (rota mais acessada)
  if (basePath === '/') {
    window.addEventListener('load', () => {
      scheduleNonCriticalRender(() => {
        import('./pages/Quiz').catch(() => {});
      }, { timeoutMs: 2000, delayMs: 1500 });
    }, { once: true });
  }
}

// ✅ OTIMIZAÇÃO: CSS crítico já está inline no index.html
// CSS não crítico será carregado pelo Vite automaticamente, mas de forma não bloqueante
// O Vite já otimiza o CSS em produção, separando em chunks quando possível
// Em desenvolvimento, o CSS é injetado via HMR de forma eficiente

// ✅ OTIMIZAÇÃO: Defer error handlers para não bloquear renderização inicial
// Carregar apenas após renderização inicial usando requestIdleCallback
if (typeof window !== 'undefined') {
  preloadInitialRouteChunks();

  const initErrorHandlers = () => {
    import('./utils/errorSuppression').then(({ setupErrorSuppression }) => {
      import('./utils/errorHandler').then(({ setupGlobalErrorHandling }) => {
        // ✅ CORREÇÃO: Configurar supressão de erros conhecidos ANTES do tratamento global
        // Isso evita que erros esperados de scripts externos em dev sejam logados
        setupErrorSuppression();
        
        // ✅ CORREÇÃO: Configurar tratamento global de erros ANTES de tudo
        setupGlobalErrorHandling();
      });
    });
  };

  scheduleOnFirstInteraction(initErrorHandlers, { timeoutMs: 5000 });
}

if (typeof window !== "undefined") {
  setupQuizBeaconSave();

  // ✅ CORREÇÃO: Remover Service Worker na Landing Page para evitar cache stale/offline
  if ('serviceWorker' in navigator && !window.location.pathname.startsWith('/admin')) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        // Apenas remover se não for o SW do admin ou se estivermos na raiz
        registration.unregister().catch(() => {});
      }
    });
  }
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  const loadDevMonitor = () => {
    import('./utils/devNavigationLoopMonitor').then(({ setupDevNavigationLoopMonitor }) => {
      setupDevNavigationLoopMonitor();
    });
  };

  scheduleNonCriticalRender(loadDevMonitor, { timeoutMs: 5000, delayMs: 500 });
}

if (document.readyState === "loading") {
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.__REACT_READY__) initializeReact();
  });
} else {
  initializeReact();
}
