import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface User {
  id: number;
  uuid: string;
  username: string;
  fullName: string;
  role: string;
  permissions: string[];
  isActive: boolean;
  createdAt: string;
}

interface AuthContextType {
  currentUser: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (key: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    let cancelled = false;
    window.electronAPI
      .getCurrentUser()
      .then((user) => {
        if (!cancelled) setCurrentUser(user);
      })
      .catch(() => {
        if (!cancelled) setCurrentUser(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const user = await window.electronAPI.login(username, password);
    setCurrentUser(user);
  }, []);

  const logout = useCallback(async () => {
    await window.electronAPI.logout();
    setCurrentUser(null);
  }, []);

  const hasPermission = useCallback(
    (key: string) => {
      if (!currentUser) return false;
      if (currentUser.role === 'ADMIN') return true;
      const perms = Array.isArray(currentUser.permissions) ? currentUser.permissions : typeof currentUser.permissions === 'string' ? (() => { try { return JSON.parse(currentUser.permissions); } catch { return []; } })() : [];
      return perms.includes(key);
    },
    [currentUser],
  );

  return (
    <AuthContext.Provider value={{ currentUser, isLoading, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
