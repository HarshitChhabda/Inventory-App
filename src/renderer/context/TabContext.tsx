import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo, ReactNode } from 'react';

export interface Tab {
  id: string;
  title: string;
  path: string;
  closable: boolean;
  dirty?: boolean;
}

interface TabContextType {
  tabs: Tab[];
  activeTabId: string;
  addTab: (path: string, title: string, opts?: { unique?: boolean; suffix?: string }) => void;
  removeTab: (id: string) => string;
  switchTab: (id: string) => string;
  closeOtherTabs: (id: string) => string;
  closeAllTabs: () => string;
  moveTab: (fromIndex: number, toIndex: number) => void;
  setTabDirty: (id: string, dirty: boolean) => void;
  closeTabOnSave: (id?: string) => string;
  hasDirtyTabs: () => boolean;
  nextTab: () => string;
  prevTab: () => string;
  goToTab: (n: number) => string;
  setNavigateFn: (fn: (path: string) => void) => void;
}

const TabContext = createContext<TabContextType | undefined>(undefined);

const dashTab: Tab = { id: 'dashboard', title: 'Dashboard', path: '/', closable: false };

let tabCounter = 0;
const generateTabId = () => `tab-${++tabCounter}-${Date.now()}`;

function loadTabs(): Tab[] {
  return [dashTab];
}

function loadActiveTabId(): string {
  return 'dashboard';
}

export function TabProvider({ children }: { children: ReactNode }) {
  const [tabs, setTabs] = useState<Tab[]>(loadTabs);
  const [activeTabId, setActiveTabId] = useState<string>(loadActiveTabId);
  const activeTabIdRef = useRef(activeTabId);
  const navigateRef = useRef<((path: string) => void) | null>(null);

  const setNavigateFn = useCallback((fn: (path: string) => void) => {
    navigateRef.current = fn;
  }, []);

  const navigateTo = useCallback((path: string) => {
    if (navigateRef.current) navigateRef.current(path);
  }, []);

  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  const addTab = useCallback((path: string, title: string, opts?: { unique?: boolean; suffix?: string }) => {
    const currentTabs = tabsRef.current;
    if (opts?.unique) {
      const newTab: Tab = {
        id: generateTabId(),
        title: opts.suffix ? `${title} (${opts.suffix})` : title,
        path,
        closable: true,
      };
      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(newTab.id);
      return;
    }
    const existing = currentTabs.find((t) => t.path === path);
    if (existing) {
      setActiveTabId(existing.id);
      return;
    }
    const newTab: Tab = {
      id: generateTabId(),
      title,
      path,
      closable: path !== '/',
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, []);

  const removeTab = useCallback((id: string): string => {
    const currentTabs = tabsRef.current;
    const idx = currentTabs.findIndex((t) => t.id === id);
    if (idx === -1) return '/';
    const newTabs = currentTabs.filter((t) => t.id !== id);
    if (newTabs.length === 0) {
      setTabs([dashTab]);
      setActiveTabId('dashboard');
      return '/';
    }
    const newIdx = Math.min(idx, newTabs.length - 1);
    const nextPath = newTabs[newIdx].path;
    if (activeTabIdRef.current === id) {
      setActiveTabId(newTabs[newIdx].id);
    }
    setTabs(newTabs);
    return nextPath;
  }, []);

  const switchTab = useCallback((id: string): string => {
    setActiveTabId(id);
    const tab = tabsRef.current.find((t) => t.id === id);
    const path = tab?.path || '/';
    navigateTo(path);
    return path;
  }, [navigateTo]);

  const closeOtherTabs = useCallback((id: string): string => {
    const currentTabs = tabsRef.current;
    const kept = currentTabs.filter((t) => t.id === id || !t.closable);
    setTabs(kept.length > 0 ? kept : [dashTab]);
    setActiveTabId(id);
    const keptTab = kept.find((t) => t.id === id);
    return keptTab?.path || '/';
  }, []);

  const closeAllTabs = useCallback((): string => {
    setTabs([dashTab]);
    setActiveTabId('dashboard');
    return '/';
  }, []);

  const moveTab = useCallback((fromIndex: number, toIndex: number) => {
    setTabs((prev) => {
      if (fromIndex < 0 || fromIndex >= prev.length || toIndex < 0 || toIndex >= prev.length) return prev;
      const newTabs = [...prev];
      const [moved] = newTabs.splice(fromIndex, 1);
      newTabs.splice(toIndex, 0, moved);
      return newTabs;
    });
  }, []);

  const setTabDirty = useCallback((id: string, dirty: boolean) => {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, dirty } : t)));
  }, []);

  const closeTabOnSave = useCallback((id?: string): string => {
    const currentTabs = tabsRef.current;
    const targetId = id || activeTabIdRef.current;
    const tab = currentTabs.find((t) => t.id === targetId);
    if (!tab || !tab.closable) return tab?.path || '/';
    const newTabs = currentTabs.filter((t) => t.id !== targetId);
    if (newTabs.length === 0) {
      setTabs([dashTab]);
      setActiveTabId('dashboard');
      return '/';
    }
    const idx = currentTabs.findIndex((t) => t.id === targetId);
    const newIdx = Math.min(idx, newTabs.length - 1);
    setActiveTabId(newTabs[newIdx].id);
    setTabs(newTabs);
    return newTabs[newIdx].path;
  }, []);

  const hasDirtyTabs = useCallback(() => {
    return tabs.some((t) => t.dirty);
  }, [tabs]);

  const nextTab = useCallback(() => {
    const currentTabs = tabsRef.current;
    const idx = currentTabs.findIndex((t) => t.id === activeTabIdRef.current);
    if (idx === -1 || currentTabs.length <= 1) return '/';
    const next = currentTabs[(idx + 1) % currentTabs.length];
    setActiveTabId(next.id);
    navigateTo(next.path);
    return next.path;
  }, [navigateTo]);

  const prevTab = useCallback(() => {
    const currentTabs = tabsRef.current;
    const idx = currentTabs.findIndex((t) => t.id === activeTabIdRef.current);
    if (idx === -1 || currentTabs.length <= 1) return '/';
    const prev = currentTabs[(idx - 1 + currentTabs.length) % currentTabs.length];
    setActiveTabId(prev.id);
    navigateTo(prev.path);
    return prev.path;
  }, [navigateTo]);

  const goToTab = useCallback((n: number) => {
    const currentTabs = tabsRef.current;
    if (n >= 0 && n < currentTabs.length) {
      setActiveTabId(currentTabs[n].id);
      navigateTo(currentTabs[n].path);
      return currentTabs[n].path;
    }
    return '/';
  }, [navigateTo]);

  const value = useMemo(() => ({
    tabs, activeTabId, addTab, removeTab, switchTab, closeOtherTabs, closeAllTabs,
    moveTab, setTabDirty, closeTabOnSave, hasDirtyTabs, nextTab, prevTab, goToTab, setNavigateFn,
  }), [tabs, activeTabId, addTab, removeTab, switchTab, closeOtherTabs, closeAllTabs,
    moveTab, setTabDirty, closeTabOnSave, hasDirtyTabs, nextTab, prevTab, goToTab, setNavigateFn]);

  return (
    <TabContext.Provider value={value}>
      {children}
    </TabContext.Provider>
  );
}

export function useTabs() {
  const context = useContext(TabContext);
  if (!context) throw new Error('useTabs must be used within TabProvider');
  return context;
}
