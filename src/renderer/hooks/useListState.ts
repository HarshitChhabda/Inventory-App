import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

export interface ListState {
  search: string;
  page: number;
  pageSize: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  filters: Record<string, string>;
  selectedTab: string;
  scrollTop: number;
}

const STORAGE_PREFIX = 'listState:';

const DEFAULT_STATE: ListState = {
  search: '',
  page: 0,
  pageSize: 50,
  sortBy: '',
  sortOrder: 'desc',
  filters: {},
  selectedTab: '',
  scrollTop: 0,
};

function readFromStorage(key: string): Partial<ListState> | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeToStorage(key: string, state: Partial<ListState>): void {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(state));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

export function clearListState(key: string): void {
  try {
    sessionStorage.removeItem(STORAGE_PREFIX + key);
  } catch {
    // ignore
  }
}

export function useListState(
  pageKey: string,
  defaults?: Partial<ListState>,
) {
  const mergedDefaults = useMemo(
    () => ({ ...DEFAULT_STATE, ...defaults }),
    // defaults is expected to be a stable object (literal or memoized by caller)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(defaults)],
  );

  const [state, setState] = useState<ListState>(() => {
    const stored = readFromStorage(pageKey);
    if (!stored) return mergedDefaults;
    return {
      ...mergedDefaults,
      ...stored,
      filters: typeof stored.filters === 'object' && stored.filters !== null && !Array.isArray(stored.filters)
        ? { ...mergedDefaults.filters, ...stored.filters }
        : mergedDefaults.filters,
    };
  });

  // Debounced persist — only write to storage 300ms after last change
  const persistTimer = useRef<ReturnType<typeof setTimeout>>();
  const persistState = useCallback(
    (next: ListState) => {
      clearTimeout(persistTimer.current);
      persistTimer.current = setTimeout(() => {
        // Only persist meaningful fields, not transient ones like scrollTop
        const toStore: Partial<ListState> = {
          search: next.search,
          page: next.page,
          pageSize: next.pageSize,
          sortBy: next.sortBy,
          sortOrder: next.sortOrder,
          filters: next.filters,
          selectedTab: next.selectedTab,
        };
        writeToStorage(pageKey, toStore);
      }, 300);
    },
    [pageKey],
  );

  useEffect(() => {
    return () => clearTimeout(persistTimer.current);
  }, []);

  // Persist on every state change
  useEffect(() => {
    persistState(state);
  }, [state, persistState]);

  const updateState = useCallback((patch: Partial<ListState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      // If filters or search changed, reset to page 0
      if (
        patch.search !== undefined && patch.search !== prev.search ||
        patch.filters !== undefined && JSON.stringify(patch.filters) !== JSON.stringify(prev.filters)
      ) {
        next.page = 0;
      }
      return next;
    });
  }, []);

  const setSearch = useCallback((search: string) => {
    setState((prev) => ({ ...prev, search, page: 0 }));
  }, []);

  const setPage = useCallback((page: number) => {
    setState((prev) => ({ ...prev, page }));
  }, []);

  const setPageSize = useCallback((pageSize: number) => {
    setState((prev) => ({ ...prev, pageSize, page: 0 }));
  }, []);

  const setSort = useCallback((sortBy: string, sortOrder: 'asc' | 'desc') => {
    setState((prev) => ({ ...prev, sortBy, sortOrder, page: 0 }));
  }, []);

  const setFilter = useCallback((key: string, value: string) => {
    setState((prev) => ({
      ...prev,
      filters: { ...prev.filters, [key]: value },
      page: 0,
    }));
  }, []);

  const clearFilter = useCallback((key: string) => {
    setState((prev) => {
      const next = { ...prev.filters };
      delete next[key];
      return { ...prev, filters: next, page: 0 };
    });
  }, []);

  const setSelectedTab = useCallback((selectedTab: string) => {
    setState((prev) => ({ ...prev, selectedTab, page: 0 }));
  }, []);

  const setScrollTop = useCallback((scrollTop: number) => {
    setState((prev) => ({ ...prev, scrollTop }));
  }, []);

  const resetState = useCallback(() => {
    setState(mergedDefaults);
    clearListState(pageKey);
  }, [mergedDefaults, pageKey]);

  const clampPage = useCallback((totalItems: number) => {
    const maxPage = Math.max(0, Math.ceil(totalItems / state.pageSize) - 1);
    if (state.page > maxPage) {
      setState((prev) => ({ ...prev, page: maxPage }));
    }
  }, [state.page, state.pageSize]);

  return {
    state,
    updateState,
    setSearch,
    setPage,
    setPageSize,
    setSort,
    setFilter,
    clearFilter,
    setSelectedTab,
    setScrollTop,
    resetState,
    clampPage,
  };
}
