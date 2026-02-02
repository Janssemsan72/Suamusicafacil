import { useState, useEffect, useRef, useCallback, RefObject } from 'react';

interface UseLazyLoadCardsOptions {
  itemsPerBatch?: number;
  initialBatch?: number;
  threshold?: number; // Intersection Observer threshold
}

/**
 * Hook para carregar cards progressivamente conforme o usuário rola
 */
export function useLazyLoadCards<T>(
  items: T[],
  options: UseLazyLoadCardsOptions = {}
) {
  const {
    itemsPerBatch = 12, // Carregar 12 cards por vez (3 linhas de 4 cards)
    initialBatch = 12, // Carregar 12 cards inicialmente
    threshold = 0.1 // Carregar quando 10% do último card estiver visível
  } = options;

  const [visibleCount, setVisibleCount] = useState(Math.min(initialBatch, items.length));
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null) as RefObject<HTMLDivElement>;

  // Reset quando items mudam
  useEffect(() => {
    setVisibleCount(Math.min(initialBatch, items.length));
  }, [items.length, initialBatch]);

  // Função para carregar mais items
  const loadMore = useCallback(() => {
    setVisibleCount(prev => Math.min(prev + itemsPerBatch, items.length));
  }, [items.length, itemsPerBatch]);

  // Configurar Intersection Observer
  useEffect(() => {
    // Se já carregou tudo, não precisa do observer
    if (visibleCount >= items.length) {
      if (observerRef.current && sentinelRef.current) {
        observerRef.current.unobserve(sentinelRef.current);
      }
      return;
    }

    // Criar observer se não existir
    if (!observerRef.current) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          const [entry] = entries;
          if (entry.isIntersecting) {
            loadMore();
          }
        },
        {
          threshold,
          rootMargin: '400px' // ✅ OTIMIZAÇÃO: Começar a carregar 400px antes (mais cedo para melhor UX)
        }
      );
    }

    // Observar sentinel
    const sentinel = sentinelRef.current;
    if (sentinel && observerRef.current) {
      observerRef.current.observe(sentinel);
    }

    return () => {
      if (observerRef.current && sentinel) {
        observerRef.current.unobserve(sentinel);
      }
    };
  }, [visibleCount, items.length, loadMore, threshold]);

  // Limpar observer ao desmontar
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  const visibleItems = items.slice(0, visibleCount);
  const hasMore = visibleCount < items.length;

  return {
    visibleItems,
    hasMore,
    sentinelRef,
    loadMore
  };
}

