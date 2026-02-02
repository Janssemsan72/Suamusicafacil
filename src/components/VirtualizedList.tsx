import React, { memo, forwardRef } from 'react';
import { useVirtualization } from '@/hooks/use-virtualization';
import { cn } from '@/lib/utils';

interface VirtualizedListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
  overscan?: number;
}

const VirtualizedList = memo(forwardRef<HTMLDivElement, VirtualizedListProps<any>>(
  ({ items, itemHeight, containerHeight, renderItem, className, overscan = 5 }, ref) => {
    const { startIndex, endIndex, totalHeight, offsetY } = useVirtualization(
      items,
      { itemHeight, containerHeight, overscan }
    );

    const visibleItems = items.slice(startIndex, endIndex + 1);

    return (
      <div
        ref={ref}
        id="virtual-container"
        className={cn('overflow-auto', className)}
        style={{ height: containerHeight }}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          <div
            style={{
              transform: `translateY(${offsetY}px)`,
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0
            }}
          >
            {visibleItems.map((item, index) => (
              <div
                key={startIndex + index}
                style={{ height: itemHeight }}
              >
                {renderItem(item, startIndex + index)}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
)) as <T>(props: VirtualizedListProps<T> & { ref?: React.Ref<HTMLDivElement> }) => React.ReactElement;

(VirtualizedList as any).displayName = 'VirtualizedList';

export default VirtualizedList;
