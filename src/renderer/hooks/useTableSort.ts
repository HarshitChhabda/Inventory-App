import { useState, useCallback, useMemo } from 'react';

export interface SortConfig {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useTableSort(defaultSortBy = 'name', defaultOrder: 'asc' | 'desc' = 'asc') {
  const [sortBy, setSortBy] = useState(defaultSortBy);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(defaultOrder);

  const handleSort = useCallback((field: string) => {
    setSortOrder((prev) => (sortBy === field ? (prev === 'asc' ? 'desc' : 'asc') : 'asc'));
    setSortBy(field);
  }, [sortBy]);

  const sortData = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <T extends Record<string, any>>(data: T[]): T[] => {
      if (!data) return [];
      return [...data].sort((a, b) => {
        let valA: any = a[sortBy];
        let valB: any = b[sortBy];
        if (typeof valA === 'string') {
          valA = valA.toLowerCase();
          valB = (valB || '').toLowerCase();
        }
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    },
    [sortBy, sortOrder]
  );

  const sortConfig = useMemo(() => ({ sortBy, sortOrder }), [sortBy, sortOrder]);

  return { sortBy, sortOrder, handleSort, sortData, sortConfig };
}
