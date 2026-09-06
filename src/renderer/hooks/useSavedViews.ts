import { useState, useCallback, useEffect } from 'react';

// ============================================================
// TYPES
// ============================================================

export interface SavedView {
  id: string;
  name: string;
  tableName: string;
  isDefault: boolean;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
  config: {
    columns: Record<string, { visible: boolean; order: number; width?: number }>;
    sort: { field: string; direction: 'asc' | 'desc' } | null;
    filters: any[];
    pageSize: number;
    groupBy?: string;
    density?: 'compact' | 'standard' | 'comfortable';
  };
}

export interface SavedViewsState {
  views: SavedView[];
  activeViewId: string | null;
}

// ============================================================
// STORAGE KEY
// ============================================================

const STORAGE_PREFIX = 'saved-views';

function getStorageKey(tableName: string): string {
  return `${STORAGE_PREFIX}:${tableName}`;
}

// ============================================================
// HOOK
// ============================================================

export function useSavedViews(tableName: string) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  // Load views from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(getStorageKey(tableName));
      if (stored) {
        const parsed = JSON.parse(stored) as SavedView[];
        setViews(parsed);

        // Set active view (default or first)
        const defaultView = parsed.find(v => v.isDefault);
        if (defaultView) {
          setActiveViewId(defaultView.id);
        } else if (parsed.length > 0) {
          setActiveViewId(parsed[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load saved views:', err);
    }
  }, [tableName]);

  // Save views to localStorage
  const saveViews = useCallback((newViews: SavedView[]) => {
    setViews(newViews);
    try {
      localStorage.setItem(getStorageKey(tableName), JSON.stringify(newViews));
    } catch (err) {
      console.error('Failed to save views:', err);
    }
  }, [tableName]);

  // Create a new view
  const createView = useCallback((
    name: string,
    config: SavedView['config'],
    isDefault: boolean = false
  ): SavedView => {
    const newView: SavedView = {
      id: `view-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      tableName,
      isDefault,
      isSystem: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      config,
    };

    const newViews = [...views, newView];
    saveViews(newViews);
    setActiveViewId(newView.id);

    return newView;
  }, [views, saveViews, tableName]);

  // Update an existing view
  const updateView = useCallback((id: string, updates: Partial<SavedView>) => {
    const newViews = views.map(v =>
      v.id === id
        ? { ...v, ...updates, updatedAt: new Date() }
        : v
    );
    saveViews(newViews);
  }, [views, saveViews]);

  // Update view config
  const updateViewConfig = useCallback((id: string, config: Partial<SavedView['config']>) => {
    const view = views.find(v => v.id === id);
    if (!view) return;

    updateView(id, {
      config: { ...view.config, ...config },
    });
  }, [views, updateView]);

  // Delete a view
  const deleteView = useCallback((id: string) => {
    const newViews = views.filter(v => v.id !== id);
    saveViews(newViews);

    // If deleted view was active, switch to default or first
    if (activeViewId === id) {
      const defaultView = newViews.find(v => v.isDefault);
      setActiveViewId(defaultView?.id || newViews[0]?.id || null);
    }
  }, [views, saveViews, activeViewId]);

  // Set default view
  const setDefaultView = useCallback((id: string) => {
    const newViews = views.map(v => ({
      ...v,
      isDefault: v.id === id,
    }));
    saveViews(newViews);
  }, [views, saveViews]);

  // Get active view config
  const activeView = views.find(v => v.id === activeViewId) || null;

  // Reset to default (no saved view)
  const resetView = useCallback(() => {
    setActiveViewId(null);
  }, []);

  // Duplicate a view
  const duplicateView = useCallback((id: string, newName: string): SavedView | null => {
    const sourceView = views.find(v => v.id === id);
    if (!sourceView) return null;

    return createView(newName, {
      ...sourceView.config,
    }, false);
  }, [views, createView]);

  return {
    views,
    activeView,
    activeViewId,
    setActiveViewId,
    createView,
    updateView,
    updateViewConfig,
    deleteView,
    setDefaultView,
    resetView,
    duplicateView,
  };
}

// ============================================================
// DEFAULT VIEWS (System views that can't be deleted)
// ============================================================

export function getDefaultViews(tableName: string): SavedView[] {
  return [
    {
      id: `${tableName}-default`,
      name: 'Default',
      tableName,
      isDefault: true,
      isSystem: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      config: {
        columns: {},
        sort: null,
        filters: [],
        pageSize: 25,
      },
    },
    {
      id: `${tableName}-compact`,
      name: 'Compact',
      tableName,
      isDefault: false,
      isSystem: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      config: {
        columns: {},
        sort: null,
        filters: [],
        pageSize: 50,
        density: 'compact',
      },
    },
    {
      id: `${tableName}-detailed`,
      name: 'Detailed',
      tableName,
      isDefault: false,
      isSystem: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      config: {
        columns: {},
        sort: null,
        filters: [],
        pageSize: 10,
        density: 'comfortable',
      },
    },
  ];
}

export default useSavedViews;
