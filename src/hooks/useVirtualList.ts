import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

/**
 * Hook customizado para virtualização de listas
 * Renderiza apenas os itens visíveis na tela
 * 
 * @param items - Array de itens para virtualizar
 * @param estimateSize - Altura estimada de cada item em pixels (padrão: 100)
 * @param overscan - Quantidade de itens extras para renderizar fora da viewport (padrão: 5)
 */
export function useVirtualList<T>(
  items: T[],
  estimateSize = 100,
  overscan = 5
) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
  });
  
  return {
    parentRef,
    virtualizer,
    virtualItems: virtualizer.getVirtualItems(),
    totalSize: virtualizer.getTotalSize(),
  };
}

/**
 * Hook para virtualização horizontal
 */
export function useVirtualGrid<T>(
  items: T[],
  columns: number,
  estimateSize = 100,
  overscan = 3
) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const rowCount = Math.ceil(items.length / columns);
  
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
  });
  
  const getItemsForRow = (rowIndex: number) => {
    const start = rowIndex * columns;
    const end = start + columns;
    return items.slice(start, end);
  };
  
  return {
    parentRef,
    virtualizer,
    virtualItems: virtualizer.getVirtualItems(),
    totalSize: virtualizer.getTotalSize(),
    getItemsForRow,
  };
}














