import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface Tab {
  id: string;
  title: string;
  path: string;
  closable: boolean;
}

interface TabContextType {
  tabs: Tab[];
  activeTabId: string;
  addTab: (path: string, title: string) => void;
  removeTab: (id: string) => void;
  switchTab: (id: string) => void;
  closeOtherTabs: (id: string) => void;
  closeAllTabs: () => void;
}

const TabContext = createContext<TabContextType | undefined>(undefined);

let tabCounter = 0;
const generateTabId = () => `tab-${++tabCounter}-${Date.now()}`;

export function TabProvider({ children }: { children: ReactNode }) {
  const [tabs, setTabs] = useState<Tab[]>([
    { id: 'dashboard', title: 'Dashboard', path: '/', closable: false },
  ]);
  const [activeTabId, setActiveTabId] = useState('dashboard');

  const addTab = useCallback((path: string, title: string) => {
    setTabs((prev) => {
      const existing = prev.find((t) => t.path === path);
      if (existing) {
        setActiveTabId(existing.id);
        return prev;
      }
      const newTab: Tab = {
        id: generateTabId(),
        title,
        path,
        closable: path !== '/',
      };
      setActiveTabId(newTab.id);
      return [...prev, newTab];
    });
  }, []);

  const removeTab = useCallback((id: string) => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      if (idx === -1) return prev;
      const newTabs = prev.filter((t) => t.id !== id);
      if (newTabs.length === 0) {
        const dashTab: Tab = { id: 'dashboard', title: 'Dashboard', path: '/', closable: false };
        setActiveTabId('dashboard');
        return [dashTab];
      }
      if (activeTabId === id) {
        const newIdx = Math.min(idx, newTabs.length - 1);
        setActiveTabId(newTabs[newIdx].id);
      }
      return newTabs;
    });
  }, [activeTabId]);

  const switchTab = useCallback((id: string) => {
    setActiveTabId(id);
  }, []);

  const closeOtherTabs = useCallback((id: string) => {
    setTabs((prev) => {
      const kept = prev.filter((t) => t.id === id || !t.closable);
      setActiveTabId(id);
      return kept.length > 0 ? kept : [{ id: 'dashboard', title: 'Dashboard', path: '/', closable: false }];
    });
  }, []);

  const closeAllTabs = useCallback(() => {
    setTabs([{ id: 'dashboard', title: 'Dashboard', path: '/', closable: false }]);
    setActiveTabId('dashboard');
  }, []);

  return (
    <TabContext.Provider value={{ tabs, activeTabId, addTab, removeTab, switchTab, closeOtherTabs, closeAllTabs }}>
      {children}
    </TabContext.Provider>
  );
}

export function useTabs() {
  const context = useContext(TabContext);
  if (!context) throw new Error('useTabs must be used within TabProvider');
  return context;
}
