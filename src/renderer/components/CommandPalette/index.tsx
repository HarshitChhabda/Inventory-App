import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Box, Typography, TextField, InputAdornment, ListItemIcon, ListItemText,
  alpha, useTheme, Chip,
} from '@mui/material';
import {
  Search, Dashboard, Warehouse, Receipt, Assignment, Transform,
  Warning, Assessment, Inventory, LocalShipping, Business, Hotel,
  Settings, Backup, CalendarMonth, History, SearchOff,
  KeyboardCommandKey, ArrowForward, Add,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTabs } from '../../context/TabContext';
import { useAuth } from '../../context/AuthContext';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  path: string;
  section: string;
  keywords: string[];
  shortcut?: string;
  permissionKey?: string;
}

const commands: CommandItem[] = [
  { id: 'dashboard', label: 'Dashboard', description: 'Overview & analytics', icon: <Dashboard sx={{ fontSize: 18 }} />, path: '/', section: 'Navigation', keywords: ['home', 'overview', 'main'] },
  { id: 'receipt-challan', label: 'Receipt Challans', description: 'Inward material tracking', icon: <Receipt sx={{ fontSize: 18 }} />, path: '/inventory/receipt-challan', section: 'Navigation', keywords: ['receive', 'vendor', 'inward', 'aamad'] },
  { id: 'issue-challan', label: 'Issue Challans', description: 'Outward material tracking', icon: <LocalShipping sx={{ fontSize: 18 }} />, path: '/inventory/issue-challan', section: 'Navigation', keywords: ['issue', 'department', 'outward', 'kharch'] },
  { id: 'transfer-challan', label: 'Transfer Challans', description: 'Inter-department transfers', icon: <Transform sx={{ fontSize: 18 }} />, path: '/inventory/transfer-challan', section: 'Navigation', keywords: ['transfer', 'move'] },
  { id: 'vendor-return', label: 'Vendor Returns', description: 'Return to vendor', icon: <Assignment sx={{ fontSize: 18 }} />, path: '/inventory/vendor-return', section: 'Navigation', keywords: ['return', 'vendor'] },
  { id: 'stock-adjustment', label: 'Stock Adjustments', description: 'Correct stock levels', icon: <Warning sx={{ fontSize: 18 }} />, path: '/inventory/stock-adjustment', section: 'Navigation', keywords: ['adjust', 'correction'] },
  { id: 'stock-ledger', label: 'Stock Ledger', description: 'Physical stock count', icon: <Assessment sx={{ fontSize: 18 }} />, path: '/inventory/stock-ledger', section: 'Navigation', keywords: ['verify', 'count', 'ledger'] },
  { id: 'damage-entry', label: 'Damage Entry', description: 'Record damaged items', icon: <Warning sx={{ fontSize: 18 }} />, path: '/inventory/damage-entry', section: 'Navigation', keywords: ['damage', 'broken'] },
  { id: 'item-history', label: 'Item History', description: 'Movement timeline', icon: <History sx={{ fontSize: 18 }} />, path: '/inventory/item-history', section: 'Navigation', keywords: ['history', 'log', 'tracking'] },
  { id: 'items-master', label: 'Items', description: 'Item master data', icon: <Inventory sx={{ fontSize: 18 }} />, path: '/masters/items', section: 'Masters', keywords: ['item', 'product', 'material'], permissionKey: 'manage_masters' },
  { id: 'categories', label: 'Categories', description: 'Item categories', icon: <Inventory sx={{ fontSize: 18 }} />, path: '/masters/categories', section: 'Masters', keywords: ['category', 'group'], permissionKey: 'manage_masters' },
  { id: 'units', label: 'Units', description: 'Measurement units', icon: <Inventory sx={{ fontSize: 18 }} />, path: '/masters/units', section: 'Masters', keywords: ['unit', 'measurement'], permissionKey: 'manage_masters' },
  { id: 'vendors', label: 'Vendors', description: 'Supplier management', icon: <LocalShipping sx={{ fontSize: 18 }} />, path: '/masters/vendors', section: 'Masters', keywords: ['vendor', 'supplier'], permissionKey: 'manage_masters' },
  { id: 'departments', label: 'Departments', description: 'Department management', icon: <Business sx={{ fontSize: 18 }} />, path: '/masters/departments', section: 'Masters', keywords: ['department', 'team', 'store'], permissionKey: 'manage_masters' },
  { id: 'locations', label: 'Locations', description: 'Room & location tracking', icon: <Warehouse sx={{ fontSize: 18 }} />, path: '/masters/locations', section: 'Masters', keywords: ['location', 'place', 'room'], permissionKey: 'manage_masters' },
  { id: 'room-details', label: 'Room Details', description: 'Facility & asset tracking', icon: <Hotel sx={{ fontSize: 18 }} />, path: '/facilities/room-details', section: 'Facilities', keywords: ['room', 'facility', 'dharmshala'] },
  { id: 'reports', label: 'Reports', description: 'Analytics & export', icon: <Assessment sx={{ fontSize: 18 }} />, path: '/reports', section: 'System', keywords: ['report', 'analysis', 'export'] },
  { id: 'financial-year', label: 'Financial Years', description: 'Manage FY periods', icon: <CalendarMonth sx={{ fontSize: 18 }} />, path: '/financial-year', section: 'System', keywords: ['financial', 'year', 'fy'], permissionKey: 'manage_financial_year' },
  { id: 'companies', label: 'Companies', description: 'Multi-company management', icon: <Business sx={{ fontSize: 18 }} />, path: '/companies', section: 'System', keywords: ['company', 'business'], permissionKey: 'manage_company' },
  { id: 'backup', label: 'Backup & Restore', description: 'Database backup', icon: <Backup sx={{ fontSize: 18 }} />, path: '/backup', section: 'System', keywords: ['backup', 'restore', 'database'], permissionKey: 'manage_backup' },
  { id: 'settings', label: 'Settings', description: 'App preferences', icon: <Settings sx={{ fontSize: 18 }} />, path: '/settings', section: 'System', keywords: ['settings', 'config', 'preference'] },
];

const quickActions: CommandItem[] = [
  { id: 'new-receipt', label: 'New Receipt Challan', description: 'Create inward entry', icon: <Add sx={{ fontSize: 18 }} />, path: '/inventory/receipt-challan/new', section: 'Quick Actions', keywords: ['create', 'new', 'receipt'], shortcut: '⌘N' },
  { id: 'new-issue', label: 'New Issue Challan', description: 'Create outward entry', icon: <Add sx={{ fontSize: 18 }} />, path: '/inventory/issue-challan/new', section: 'Quick Actions', keywords: ['create', 'new', 'issue'], shortcut: '⌘⇧I' },
  { id: 'new-transfer', label: 'New Transfer Challan', description: 'Create transfer entry', icon: <Add sx={{ fontSize: 18 }} />, path: '/inventory/transfer-challan/new', section: 'Quick Actions', keywords: ['create', 'new', 'transfer'], shortcut: '⌘⇧T' },
];

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const navigate = useNavigate();
  const { addTab } = useTabs();
  const { hasPermission } = useAuth();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const allItems = useMemo(() => {
    return [...quickActions, ...commands].filter((item) => {
      if (!item.permissionKey) return true;
      return hasPermission(item.permissionKey);
    });
  }, [hasPermission]);

  const filtered = useMemo(() => {
    if (!query.trim()) return allItems;
    const q = query.toLowerCase();
    return allItems.filter((item) =>
      item.label.toLowerCase().includes(q) ||
      item.description?.toLowerCase().includes(q) ||
      item.keywords.some((k) => k.includes(q)) ||
      item.section.toLowerCase().includes(q)
    );
  }, [query, allItems]);

  const grouped = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    filtered.forEach((item) => {
      if (!groups[item.section]) groups[item.section] = [];
      groups[item.section].push(item);
    });
    return groups;
  }, [filtered]);

  const flatList = useMemo(() => filtered, [filtered]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement;
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const handleSelect = useCallback((item: CommandItem) => {
    const pathToTitle: Record<string, string> = {};
    commands.forEach((c) => { pathToTitle[c.path] = c.label; });
    quickActions.forEach((c) => { pathToTitle[c.path] = c.label; });
    const title = pathToTitle[item.path] || item.label;
    addTab(item.path, title);
    navigate(item.path);
    onClose();
  }, [navigate, addTab, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, flatList.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && flatList[selectedIndex]) {
      e.preventDefault();
      handleSelect(flatList[selectedIndex]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [flatList, selectedIndex, handleSelect, onClose]);

  if (!open) return null;

  let runningIndex = -1;

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        pt: '15vh',
        animation: 'fadeIn 150ms ease-out forwards',
      }}
      onClick={onClose}
    >
      {/* Backdrop */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundColor: isDark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(15, 23, 42, 0.3)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      />

      {/* Palette */}
      <Box
        onClick={(e) => e.stopPropagation()}
        sx={{
          position: 'relative',
          width: '100%',
          maxWidth: 560,
          mx: 2,
          backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
          borderRadius: '16px',
          border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
          boxShadow: isDark
            ? '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.05)'
            : '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
          overflow: 'hidden',
          animation: 'scaleIn 200ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
          transformOrigin: 'top center',
        }}
      >
        {/* Search Input */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            px: 2,
            py: 0,
            borderBottom: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
          }}
        >
          <Search sx={{ fontSize: 20, color: isDark ? '#64748B' : '#94A3B8', flexShrink: 0 }} />
          <TextField
            inputRef={inputRef}
            fullWidth
            variant="standard"
            placeholder="Search pages, actions, masters..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            InputProps={{
              disableUnderline: true,
              sx: {
                py: 1.5,
                px: 1.5,
                fontSize: '0.9375rem',
                fontWeight: 500,
                color: 'text.primary',
                '& input::placeholder': {
                  color: isDark ? '#64748B' : '#94A3B8',
                  opacity: 1,
                },
              },
            }}
          />
          <Chip
            label="ESC"
            size="small"
            sx={{
              height: 22,
              fontSize: '0.625rem',
              fontWeight: 600,
              fontFamily: '"Inter", monospace',
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
              color: isDark ? '#94A3B8' : '#64748B',
              border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
        </Box>

        {/* Results */}
        <Box
          ref={listRef}
          sx={{
            maxHeight: 380,
            overflow: 'auto',
            py: 1,
            '&::-webkit-scrollbar': { width: 4 },
            '&::-webkit-scrollbar-track': { background: 'transparent' },
            '&::-webkit-scrollbar-thumb': { background: isDark ? '#475569' : '#CBD5E1', borderRadius: 2 },
          }}
        >
          {flatList.length === 0 && (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <SearchOff sx={{ fontSize: 40, color: isDark ? '#475569' : '#CBD5E1', mb: 1 }} />
              <Typography variant="body2" color="text.secondary" fontWeight={500}>
                No results for "{query}"
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Try searching for pages, actions, or masters
              </Typography>
            </Box>
          )}

          {Object.entries(grouped).map(([section, items]) => (
            <Box key={section} sx={{ mb: 0.5 }}>
              <Typography
                variant="caption"
                sx={{
                  px: 2,
                  py: 0.75,
                  display: 'block',
                  fontWeight: 700,
                  fontSize: '0.625rem',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: isDark ? '#64748B' : '#94A3B8',
                }}
              >
                {section}
              </Typography>
              {items.map((item) => {
                runningIndex++;
                const idx = runningIndex;
                const isSelected = idx === selectedIndex;
                return (
                  <Box
                    key={item.id}
                    ref={(el: HTMLDivElement | null) => {
                      if (isSelected && el) el.scrollIntoView({ block: 'nearest' });
                    }}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.25,
                      px: 2,
                      py: 1,
                      mx: 1,
                      borderRadius: '10px',
                      cursor: 'pointer',
                      transition: 'all 100ms ease-out',
                      backgroundColor: isSelected
                        ? (isDark ? 'rgba(59, 130, 246, 0.12)' : '#EFF6FF')
                        : 'transparent',
                      '&:hover': {
                        backgroundColor: isDark ? 'rgba(59, 130, 246, 0.08)' : '#F1F5F9',
                      },
                    }}
                  >
                    <Box
                      sx={{
                        width: 34,
                        height: 34,
                        borderRadius: '9px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isSelected
                          ? (isDark ? 'rgba(59, 130, 246, 0.2)' : '#DBEAFE')
                          : (isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9'),
                        color: isSelected
                          ? (isDark ? '#60A5FA' : '#2563EB')
                          : (isDark ? '#94A3B8' : '#64748B'),
                        transition: 'all 100ms ease-out',
                        flexShrink: 0,
                      }}
                    >
                      {item.icon}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: isSelected ? 600 : 500,
                          fontSize: '0.8125rem',
                          color: 'text.primary',
                          lineHeight: 1.3,
                        }}
                      >
                        {item.label}
                      </Typography>
                      {item.description && (
                        <Typography
                          variant="caption"
                          sx={{
                            color: 'text.secondary',
                            fontSize: '0.6875rem',
                            lineHeight: 1.3,
                          }}
                        >
                          {item.description}
                        </Typography>
                      )}
                    </Box>
                    {item.shortcut && (
                      <Chip
                        label={item.shortcut}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.625rem',
                          fontWeight: 600,
                          fontFamily: '"Inter", monospace',
                          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
                          color: isDark ? '#94A3B8' : '#64748B',
                          border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
                          '& .MuiChip-label': { px: 0.5 },
                        }}
                      />
                    )}
                    {isSelected && (
                      <ArrowForward sx={{ fontSize: 14, color: isDark ? '#60A5FA' : '#2563EB', flexShrink: 0 }} />
                    )}
                  </Box>
                );
              })}
            </Box>
          ))}
        </Box>

        {/* Footer */}
        <Box
          sx={{
            px: 2,
            py: 1,
            borderTop: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 18, height: 18, borderRadius: '4px',
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
              border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
            }}>
              <Typography sx={{ fontSize: '9px', fontWeight: 700, fontFamily: '"Inter", monospace', color: isDark ? '#94A3B8' : '#64748B' }}>↑</Typography>
            </Box>
            <Box sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 18, height: 18, borderRadius: '4px',
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
              border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
            }}>
              <Typography sx={{ fontSize: '9px', fontWeight: 700, fontFamily: '"Inter", monospace', color: isDark ? '#94A3B8' : '#64748B' }}>↓</Typography>
            </Box>
            <Typography variant="caption" sx={{ fontSize: '0.625rem', color: isDark ? '#64748B' : '#94A3B8', fontWeight: 500 }}>
              Navigate
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: 18, px: 0.5, borderRadius: '4px',
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
              border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
            }}>
              <Typography sx={{ fontSize: '9px', fontWeight: 700, fontFamily: '"Inter", monospace', color: isDark ? '#94A3B8' : '#64748B' }}>↵</Typography>
            </Box>
            <Typography variant="caption" sx={{ fontSize: '0.625rem', color: isDark ? '#64748B' : '#94A3B8', fontWeight: 500 }}>
              Select
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: 18, px: 0.5, borderRadius: '4px',
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
              border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
            }}>
              <Typography sx={{ fontSize: '9px', fontWeight: 700, fontFamily: '"Inter", monospace', color: isDark ? '#94A3B8' : '#64748B' }}>ESC</Typography>
            </Box>
            <Typography variant="caption" sx={{ fontSize: '0.625rem', color: isDark ? '#64748B' : '#94A3B8', fontWeight: 500 }}>
              Close
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
