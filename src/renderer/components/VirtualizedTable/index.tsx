import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

interface VirtualizedTableProps {
  rows: any[];
  height?: number;
  rowHeight?: number;
  children: (rows: any[]) => React.ReactNode;
}

export function VirtualizedTable({ rows, height = 400, rowHeight = 44, children }: VirtualizedTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  });

  return (
    <div ref={parentRef} style={{ height, overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {rows[virtualRow.index]}
          </div>
        ))}
      </div>
    </div>
  );
}

export default VirtualizedTable;
