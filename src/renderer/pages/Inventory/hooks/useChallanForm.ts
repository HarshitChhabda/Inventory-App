import { useState, useCallback, useMemo } from 'react';

interface UseChallanFormOptions<T extends { itemId: number; quantity: number }> {
  storageKey: string;
  initialItem: () => T;
}

export function useChallanForm<T extends { itemId: number; quantity: number }>({
  storageKey,
  initialItem,
}: UseChallanFormOptions<T>) {
  const [items, setItems] = useState<T[]>([]);

  const [recentItemIds, setRecentItemIds] = useState<number[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || '[]');
    } catch {
      return [];
    }
  });

  const addItem = useCallback(() => {
    setItems((prev) => [...prev, initialItem()]);
  }, [initialItem]);

  const updateItem = useCallback(
    (index: number, field: keyof T, value: T[keyof T]) => {
      setItems((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: value };
        return next;
      });
    },
    []
  );

  const removeItem = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const setItemsArray = useCallback((updater: T[] | ((prev: T[]) => T[])) => {
    setItems((prev) =>
      typeof updater === 'function' ? (updater as (prev: T[]) => T[])(prev) : updater
    );
  }, []);

  const trackRecentItem = useCallback(
    (itemId: number) => {
      setRecentItemIds((prev) => {
        const next = [itemId, ...prev.filter((r) => r !== itemId)].slice(0, 8);
        localStorage.setItem(storageKey, JSON.stringify(next));
        return next;
      });
    },
    [storageKey]
  );

  const isItemTracked = useCallback(
    (itemId: number) => items.some((i) => i.itemId === itemId),
    [items]
  );

  const totalAmount = useMemo(
    () =>
      items.reduce(
        (sum, i) =>
          sum + i.quantity * ((i as unknown as { rate?: number }).rate ?? 0),
        0
      ),
    [items]
  );

  return {
    items,
    setItems: setItemsArray,
    recentItemIds,
    addItem,
    updateItem,
    removeItem,
    trackRecentItem,
    isItemTracked,
    totalAmount,
  };
}
