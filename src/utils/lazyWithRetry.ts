import { ComponentType, lazy, LazyExoticComponent } from 'react';
import { getOptimizedRetries, getOptimizedRetryDelay, getDeviceInfo } from './deviceDetection';

/**
 * Wrapper para lazy loading com retry automático em caso de falha de rede
 * Resolve o problema de "Failed to fetch dynamically imported module"
 * ✅ OTIMIZAÇÃO MOBILE: Ajusta retries e delays baseado no dispositivo
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  retries?: number,
  delay?: number
): LazyExoticComponent<T> & { prefetch: () => Promise<{ default: T }> } {
  const loadWithRetry = async (attempt = 0): Promise<{ default: T }> => {
    try {
      return await importFn();
    } catch (error) {
      // ✅ OTIMIZAÇÃO MOBILE: Obter valores otimizados baseados no dispositivo
      const deviceInfo = getDeviceInfo();
      const maxRetries = retries !== undefined 
        ? getOptimizedRetries(retries)
        : getOptimizedRetries(3); // Default: 3 retries
      const retryDelay = delay !== undefined
        ? getOptimizedRetryDelay(delay)
        : getOptimizedRetryDelay(1000); // Default: 1000ms
      
      // Se ainda há tentativas e o erro é relacionado a rede
      if (attempt < maxRetries && (
        error instanceof TypeError ||
        (error instanceof Error && (
          error.message.includes('Failed to fetch') ||
          error.message.includes('NetworkError') ||
          error.message.includes('Load failed') ||
          error.message.includes('dynamically imported module')
        ))
      )) {
        // Aguardar antes de tentar novamente (backoff exponencial)
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
        
        return loadWithRetry(attempt + 1);
      }
      
      // Se esgotou as tentativas ou erro não é de rede, relançar
      throw error;
    }
  };

  const LazyComponent = lazy(() => loadWithRetry()) as LazyExoticComponent<T> & { prefetch: () => Promise<{ default: T }> };
  
  // ✅ Adicionar método prefetch para carregamento manual
  LazyComponent.prefetch = () => loadWithRetry();
  
  return LazyComponent;
}

