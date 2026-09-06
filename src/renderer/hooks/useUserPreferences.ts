import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

interface UseUserPreferencesOptions {
  maxRecent?: number;
  prefix?: string;
}

interface UserPreferencesResult {
  getPreference: (key: string) => Promise<string | null>;
  setPreference: (key: string, value: string) => Promise<void>;
  getAllPreferences: () => Promise<Record<string, string>>;
  getRecentValues: (key: string) => Promise<string[]>;
  addRecentValue: (key: string, value: string) => Promise<void>;
  preferences: Record<string, string>;
  isLoading: boolean;
}

export function useUserPreferences(options?: UseUserPreferencesOptions): UserPreferencesResult {
  const { currentUser } = useAuth();
  const maxRecent = options?.maxRecent ?? 8;
  const prefix = options?.prefix ?? 'ui.';
  const [preferences, setPreferences] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!currentUser?.id || loadedRef.current) return;
    loadedRef.current = true;
    window.electronAPI.getAllPreferences(currentUser.id)
      .then((prefs: Record<string, string>) => {
        setPreferences(prefs || {});
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [currentUser?.id]);

  const getPreference = useCallback(async (key: string): Promise<string | null> => {
    if (!currentUser?.id) return null;
    if (preferences[prefix + key] !== undefined) return preferences[prefix + key];
    const val = await window.electronAPI.getPreference(currentUser.id, prefix + key);
    if (val !== null) {
      setPreferences((prev) => ({ ...prev, [prefix + key]: val }));
    }
    return val;
  }, [currentUser?.id, preferences, prefix]);

  const setPreference = useCallback(async (key: string, value: string): Promise<void> => {
    if (!currentUser?.id) return;
    await window.electronAPI.setPreference(currentUser.id, prefix + key, value);
    setPreferences((prev) => ({ ...prev, [prefix + key]: value }));
  }, [currentUser?.id, prefix]);

  const getAllPreferences = useCallback(async (): Promise<Record<string, string>> => {
    if (!currentUser?.id) return {};
    const prefs = await window.electronAPI.getAllPreferences(currentUser.id);
    setPreferences(prefs || {});
    return prefs || {};
  }, [currentUser?.id]);

  const getRecentValues = useCallback(async (key: string): Promise<string[]> => {
    if (!currentUser?.id) return [];
    const recentKey = `${prefix}recent.${key}`;
    const raw = await window.electronAPI.getPreference(currentUser.id, recentKey);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.slice(0, maxRecent) : [];
    } catch {
      return [];
    }
  }, [currentUser?.id, prefix, maxRecent]);

  const addRecentValue = useCallback(async (key: string, value: string): Promise<void> => {
    if (!currentUser?.id || !value?.trim()) return;
    const recentKey = `${prefix}recent.${key}`;
    const existing = await getRecentValues(key);
    const filtered = existing.filter((v) => v !== value);
    const updated = [value, ...filtered].slice(0, maxRecent);
    await window.electronAPI.setPreference(currentUser.id, recentKey, JSON.stringify(updated));
  }, [currentUser?.id, prefix, maxRecent, getRecentValues]);

  return {
    getPreference,
    setPreference,
    getAllPreferences,
    getRecentValues,
    addRecentValue,
    preferences,
    isLoading,
  };
}

export default useUserPreferences;
