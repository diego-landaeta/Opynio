import React, { useState, useEffect, useRef, useMemo, memo } from 'react';

interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number;
  className?: string;
}

function VirtualList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 5,
  className = ''
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const [actualHeight, setActualHeight] = useState(containerHeight);
  const scrollElementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateHeight = () => {
      if (scrollElementRef.current) {
        const rect = scrollElementRef.current.getBoundingClientRect();
        setActualHeight(rect.height || containerHeight);
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, [containerHeight]);

  const totalHeight = items.length * itemHeight;

  const visibleRange = useMemo(() => {
    const start = Math.floor(scrollTop / itemHeight);
    const end = Math.min(
      start + Math.ceil(actualHeight / itemHeight),
      items.length - 1
    );

    return {
      start: Math.max(0, start - overscan),
      end: Math.min(items.length - 1, end + overscan)
    };
  }, [scrollTop, itemHeight, actualHeight, items.length, overscan]);

  const visibleItems = useMemo(() => {
    const result = [];
    for (let i = visibleRange.start; i <= visibleRange.end; i++) {
      result.push({
        index: i,
        item: items[i],
        offsetY: i * itemHeight
      });
    }
    return result;
  }, [items, visibleRange, itemHeight]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  return (
    <div
      ref={scrollElementRef}
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map(({ item, index, offsetY }) => (
          <div
            key={index}
            style={{
              position: 'absolute',
              top: offsetY,
              left: 0,
              right: 0,
              height: itemHeight
            }}
          >
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(VirtualList) as <T>(props: VirtualListProps<T>) => JSX.Element;