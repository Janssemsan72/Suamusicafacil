import { lazy, Suspense, useEffect, useRef, useState, ReactNode } from 'react';
import { scheduleNonCriticalRender } from '@/utils/scheduleNonCriticalRender';

interface LazyComponentProps {
  children: ReactNode;
  fallback?: ReactNode;
  rootMargin?: string;
  forceLoad?: boolean;
  minHeight?: number;
}

/**
 * Componente que carrega children apenas quando está próximo da viewport
 * Usa Intersection Observer para lazy load eficiente
 * ✅ OTIMIZAÇÃO: rootMargin de 100px para pré-carregar antes de entrar na viewport, delay reduzido para melhor UX
 */
export function LazyComponent({ 
  children, 
  fallback = null, 
  rootMargin = '200px 0px',
  forceLoad = false,
  minHeight = 200
}: LazyComponentProps) {
  const [shouldLoad, setShouldLoad] = useState(forceLoad);
  const ref = useRef<HTMLDivElement>(null);
  const cancelScheduledLoadRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (forceLoad) {
      setShouldLoad(true);
      return;
    }

    const element = ref.current;
    if (!element || shouldLoad) return;

    const loadComponent = () => {
      setShouldLoad(true);
    };

    const scheduleLoad = () => {
      cancelScheduledLoadRef.current?.();
      cancelScheduledLoadRef.current = scheduleNonCriticalRender(loadComponent, { timeoutMs: 500, delayMs: 0 });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // ✅ OTIMIZAÇÃO: Delay reduzido para 150ms para melhor percepção de velocidade
            scheduleLoad();
            observer.disconnect();
          }
        });
      },
      { rootMargin }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
      cancelScheduledLoadRef.current?.();
      cancelScheduledLoadRef.current = null;
    };
  }, [shouldLoad, rootMargin, forceLoad]);

  const defaultPlaceholder = <div style={{ minHeight }} aria-hidden="true" />;
  const suspenseFallback = fallback ?? defaultPlaceholder;

  return (
    <div ref={ref}>
      {shouldLoad ? (
        <Suspense fallback={suspenseFallback}>
          {children}
        </Suspense>
      ) : (
        suspenseFallback
      )}
    </div>
  );
}

/**
 * Helper para criar lazy components com retry
 */
export function createLazyComponent<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await importFn();
    } catch (error) {
      // Retry uma vez após 1 segundo
      await new Promise(resolve => setTimeout(resolve, 1000));
      return await importFn();
    }
  });
}

