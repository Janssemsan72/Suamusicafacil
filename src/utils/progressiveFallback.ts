/**
 * ✅ FASE 3: Sistema de fallback progressivo
 * Funcionalidades essenciais sempre disponíveis
 * Funcionalidades avançadas apenas se suportadas
 */

import { detectBrowser } from './browserDetection';

export interface FeatureSupport {
  available: boolean;
  fallback?: () => void;
  message?: string;
}

/**
 * Verifica se uma feature está disponível e retorna fallback se necessário
 */
export function checkFeature(feature: string): FeatureSupport {
  const browser = detectBrowser();
  
  switch (feature) {
    case 'serviceWorker':
      return {
        available: browser.supportsServiceWorker,
        fallback: () => {
          console.warn('[ProgressiveFallback] Service Worker não disponível, usando cache manual');
        },
        message: browser.supportsServiceWorker 
          ? undefined 
          : 'Service Worker não suportado - funcionalidade offline limitada'
      };
    
    case 'localStorage':
      return {
        available: browser.supportsLocalStorage,
        fallback: () => {
          console.warn('[ProgressiveFallback] LocalStorage não disponível, usando memória');
        },
        message: browser.supportsLocalStorage 
          ? undefined 
          : 'LocalStorage não disponível - dados podem ser perdidos ao recarregar'
      };
    
    case 'fetch':
      return {
        available: browser.supportsFetch,
        fallback: () => {
          console.warn('[ProgressiveFallback] Fetch não disponível, usando XMLHttpRequest');
        },
        message: browser.supportsFetch 
          ? undefined 
          : 'Fetch API não disponível - usando fallback'
      };
    
    case 'cssVariables':
      return {
        available: browser.supportsCSSVariables,
        fallback: () => {
          console.warn('[ProgressiveFallback] CSS Variables não disponível, usando valores padrão');
        },
        message: browser.supportsCSSVariables 
          ? undefined 
          : 'CSS Variables não suportado - usando fallbacks'
      };
    
    case 'flexbox':
      return {
        available: browser.supportsFlexbox,
        fallback: () => {
          console.warn('[ProgressiveFallback] Flexbox não disponível, usando layout alternativo');
        },
        message: browser.supportsFlexbox 
          ? undefined 
          : 'Flexbox não suportado - layout pode ser diferente'
      };
    
    case 'grid':
      return {
        available: browser.supportsGrid,
        fallback: () => {
          console.warn('[ProgressiveFallback] CSS Grid não disponível, usando flexbox');
        },
        message: browser.supportsGrid 
          ? undefined 
          : 'CSS Grid não suportado - usando flexbox fallback'
      };
    
    default:
      return {
        available: true,
        message: undefined
      };
  }
}

/**
 * Executa função apenas se feature estiver disponível, senão executa fallback
 */
export function withFallback<T>(
  feature: string,
  fn: () => T,
  fallbackFn?: () => T
): T | undefined {
  const support = checkFeature(feature);
  
  if (support.available) {
    try {
      return fn();
    } catch (error) {
      console.warn(`[ProgressiveFallback] Erro ao executar ${feature}, usando fallback:`, error);
      if (fallbackFn) {
        return fallbackFn();
      }
      if (support.fallback) {
        support.fallback();
      }
      return undefined;
    }
  } else {
    if (support.message) {
      console.warn(`[ProgressiveFallback] ${support.message}`);
    }
    if (fallbackFn) {
      return fallbackFn();
    }
    if (support.fallback) {
      support.fallback();
    }
    return undefined;
  }
}

/**
 * Retorna função que executa apenas se feature estiver disponível
 */
export function createConditionalFunction<T extends (...args: any[]) => any>(
  feature: string,
  fn: T,
  fallbackFn?: T
): T {
  return ((...args: any[]) => {
    return withFallback(feature, () => fn(...args), fallbackFn ? () => fallbackFn(...args) : undefined);
  }) as T;
}

/**
 * Modo degradado - desabilita funcionalidades avançadas
 */
export function enableDegradedMode(): void {
  const browser = detectBrowser();
  
  if (browser.isVeryOldBrowser || browser.isOldBrowser) {
    document.documentElement.classList.add('degraded-mode');
    
    // Desabilitar animações complexas
    const style = document.createElement('style');
    style.textContent = `
      .degraded-mode * {
        animation-duration: 0s !important;
        transition-duration: 0s !important;
      }
      .degraded-mode [data-animate] {
        opacity: 1 !important;
        transform: none !important;
      }
    `;
    document.head.appendChild(style);
    
    console.log('[ProgressiveFallback] Modo degradado ativado para melhor compatibilidade');
  }
}

/**
 * Verifica se deve usar modo degradado
 */
export function shouldUseDegradedMode(): boolean {
  const browser = detectBrowser();
  return browser.isVeryOldBrowser || browser.isOldBrowser;
}



