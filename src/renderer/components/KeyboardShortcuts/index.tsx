import React, { createContext, useContext, useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  Stack,
} from '@mui/material';

// ============================================================
// TYPES
// ============================================================

export interface KeyboardShortcut {
  id: string;
  keys: string[];
  description: string;
  action: () => void;
  category: string;
  enabled?: boolean;
}

export interface KeyboardShortcutsContextType {
  shortcuts: KeyboardShortcut[];
  registerShortcut: (shortcut: Omit<KeyboardShortcut, 'enabled'>) => void;
  unregisterShortcut: (id: string) => void;
  enabledShortcuts: KeyboardShortcut[];
  showHelp: boolean;
  setShowHelp: (show: boolean) => void;
}

// ============================================================
// CONTEXT
// ============================================================

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextType | null>(null);

// ============================================================
// PROVIDER
// ============================================================

export function KeyboardShortcutsProvider({ children }: { children: React.ReactNode }) {
  const [shortcuts, setShortcuts] = useState<KeyboardShortcut[]>([]);
  const [showHelp, setShowHelp] = useState(false);

  const registerShortcut = useCallback((shortcut: Omit<KeyboardShortcut, 'enabled'>) => {
    setShortcuts(prev => {
      const existing = prev.find(s => s.id === shortcut.id);
      if (existing) {
        return prev.map(s => s.id === shortcut.id ? { ...shortcut, enabled: true } : s);
      }
      return [...prev, { ...shortcut, enabled: true }];
    });
  }, []);

  const unregisterShortcut = useCallback((id: string) => {
    setShortcuts(prev => prev.filter(s => s.id !== id));
  }, []);

  const enabledShortcuts = shortcuts.filter(s => s.enabled !== false);

  // Global keyboard handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger in input/textarea/select
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        // Allow Escape in inputs
        if (e.key !== 'Escape') return;
      }

      // Check for ? to show help
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowHelp(true);
        return;
      }

      // Check shortcuts
      for (const shortcut of enabledShortcuts) {
        const keys = shortcut.keys.map(k => k.toLowerCase());
        const key = e.key.toLowerCase();

        const match = keys.includes(key) ||
          (e.ctrlKey && keys.includes('ctrl+' + key)) ||
          (e.metaKey && keys.includes('cmd+' + key)) ||
          (e.shiftKey && keys.includes('shift+' + key)) ||
          (e.altKey && keys.includes('alt+' + key));

        if (match) {
          e.preventDefault();
          shortcut.action();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabledShortcuts]);

  return (
    <KeyboardShortcutsContext.Provider
      value={{
        shortcuts,
        registerShortcut,
        unregisterShortcut,
        enabledShortcuts,
        showHelp,
        setShowHelp,
      }}
    >
      {children}
    </KeyboardShortcutsContext.Provider>
  );
}

// ============================================================
// HOOKS
// ============================================================

export function useKeyboardShortcuts() {
  const context = useContext(KeyboardShortcutsContext);
  if (!context) {
    throw new Error('useKeyboardShortcuts must be used within KeyboardShortcutsProvider');
  }
  return context;
}

export function useRegisterShortcut(shortcut: Omit<KeyboardShortcut, 'enabled'>) {
  const { registerShortcut, unregisterShortcut } = useKeyboardShortcuts();

  useEffect(() => {
    registerShortcut(shortcut);
    return () => unregisterShortcut(shortcut.id);
  }, [shortcut.id]);
}

// ============================================================
// DEFAULT SHORTCUTS
// ============================================================

export function DefaultKeyboardShortcuts() {
  const navigate = useNavigate();
  const { registerShortcut } = useKeyboardShortcuts();

  useEffect(() => {
    // Navigation shortcuts
    registerShortcut({
      id: 'nav-dashboard',
      keys: ['ctrl+home'],
      description: 'Go to Dashboard',
      action: () => navigate('/'),
      category: 'Navigation',
    });

    registerShortcut({
      id: 'nav-search',
      keys: ['ctrl+k', 'ctrl+/'],
      description: 'Open Search',
      action: () => {
        // Will be handled by CommandPalette
        window.dispatchEvent(new CustomEvent('open-search'));
      },
      category: 'Navigation',
    });

    registerShortcut({
      id: 'nav-receipt',
      keys: ['ctrl+n'],
      description: 'New Goods Receipt',
      action: () => navigate('/procurement/grn/new'),
      category: 'Quick Actions',
    });

    registerShortcut({
      id: 'nav-issue',
      keys: ['ctrl+shift+i'],
      description: 'New Store Issue',
      action: () => navigate('/inventory/issue-challan/new'),
      category: 'Quick Actions',
    });

    registerShortcut({
      id: 'nav-transfer',
      keys: ['ctrl+shift+t'],
      description: 'New Store Transfer',
      action: () => navigate('/inventory/transfer-challan/new'),
      category: 'Quick Actions',
    });

    registerShortcut({
      id: 'nav-items',
      keys: ['ctrl+m'],
      description: 'Go to Items Master',
      action: () => navigate('/masters/items'),
      category: 'Navigation',
    });

    registerShortcut({
      id: 'nav-stock',
      keys: ['ctrl+l'],
      description: 'Go to Stock Ledger',
      action: () => navigate('/inventory/stock-ledger'),
      category: 'Navigation',
    });

    registerShortcut({
      id: 'nav-reports',
      keys: ['ctrl+r'],
      description: 'Go to Reports',
      action: () => navigate('/reports'),
      category: 'Navigation',
    });

    registerShortcut({
      id: 'nav-settings',
      keys: ['ctrl+,'],
      description: 'Go to Settings',
      action: () => navigate('/settings'),
      category: 'Navigation',
    });

    registerShortcut({
      id: 'show-help',
      keys: ['?'],
      description: 'Show Keyboard Shortcuts',
      action: () => {
        window.dispatchEvent(new CustomEvent('show-shortcuts-help'));
      },
      category: 'Help',
    });
  }, [navigate, registerShortcut]);

  return null;
}

// ============================================================
// SHORTCUTS HELP DIALOG
// ============================================================

export function ShortcutsHelpDialog() {
  const { showHelp, setShowHelp, enabledShortcuts } = useKeyboardShortcuts();

  if (!showHelp) return null;

  const grouped = enabledShortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) acc[shortcut.category] = [];
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, KeyboardShortcut[]>);

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={() => setShowHelp(false)}
    >
      <Paper
        sx={{ p: 3, maxWidth: 500, maxHeight: '80vh', overflow: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <Typography variant="h6" fontWeight={600} gutterBottom>
          Keyboard Shortcuts
        </Typography>
        {Object.entries(grouped).map(([category, shortcuts]) => (
          <Box key={category} sx={{ mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              {category}
            </Typography>
            {shortcuts.map((shortcut) => (
              <Stack key={shortcut.id} direction="row" justifyContent="space-between" sx={{ py: 0.5 }}>
                <Typography variant="body2">{shortcut.description}</Typography>
                <Chip label={shortcut.keys.join(' + ')} size="small" variant="outlined" />
              </Stack>
            ))}
          </Box>
        ))}
        <Button onClick={() => setShowHelp(false)} fullWidth variant="outlined" sx={{ mt: 2 }}>
          Close
        </Button>
      </Paper>
    </Box>
  );
}

export default KeyboardShortcutsProvider;
