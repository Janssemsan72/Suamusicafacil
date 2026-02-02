import { useState, useEffect, useCallback, useMemo } from 'react';

interface VirtualizationOptions {
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
}

interface VirtualizationResult {
  startIndex: number;
  endIndex: number;
  totalHeight: number;
  offsetY: number;
}

/**
 * Custom hook for virtualizing large lists
 * @param items - Array of items to virtualize
 * @param options - Virtualization configuration
 * @returns Virtualization result with visible range and positioning
 */
export function useVirtualization<T>(
  items: T[],
  options: VirtualizationOptions
): VirtualizationResult {
  const { itemHeight, containerHeight, overscan = 5 } = options;
  
  const [scrollTop, setScrollTop] = useState(0);

  const handleScroll = useCallback((event: Event) => {
    const target = event.target as HTMLElement;
    setScrollTop(target.scrollTop);
  }, []);

  useEffect(() => {
    const container = document.getElementById('virtual-container');
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true });
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  const result = useMemo(() => {
    const totalHeight = items.length * itemHeight;
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      items.length - 1,
      startIndex + visibleCount + overscan * 2
    );
    
    const offsetY = startIndex * itemHeight;

    return {
      startIndex,
      endIndex,
      totalHeight,
      offsetY
    };
  }, [items.length, itemHeight, containerHeight, scrollTop, overscan]);

  return result;
}

/**
 * Hook for infinite scrolling with virtualization
 */
export function useInfiniteVirtualization<T>(
  items: T[],
  options: VirtualizationOptions & {
    hasMore: boolean;
    loadMore: () => void;
    threshold?: number;
  }
) {
  const virtualization = useVirtualization(items, options);
  const { hasMore, loadMore, threshold = 100 } = options;

  useEffect(() => {
    if (hasMore && virtualization.endIndex >= items.length - threshold) {
      loadMore();
    }
  }, [hasMore, loadMore, virtualization.endIndex, items.length, threshold]);

  return virtualization;
}
