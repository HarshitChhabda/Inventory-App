import React, { useRef, useState } from 'react';
import {
  Box, Typography, IconButton, Tooltip, alpha, useTheme, Menu, MenuItem,
  ListItemIcon, ListItemText,
} from '@mui/material';
import { Close, Dashboard, Inventory, Assessment, Settings, Backup, Business, Warehouse, ClearAll } from '@mui/icons-material';
import { useTabs } from '../../context/TabContext';

const TAB_HEIGHT = 36;

const pathToIcon: Record<string, React.ReactNode> = {
  '/': <Dashboard sx={{ fontSize: 14 }} />,
  '/inventory/receipt-challan': <Inventory sx={{ fontSize: 14 }} />,
  '/inventory/issue-challan': <Inventory sx={{ fontSize: 14 }} />,
  '/inventory/transfer-challan': <Inventory sx={{ fontSize: 14 }} />,
  '/inventory/vendor-return': <Inventory sx={{ fontSize: 14 }} />,
  '/inventory/stock-adjustment': <Inventory sx={{ fontSize: 14 }} />,
  '/inventory/stock-ledger': <Assessment sx={{ fontSize: 14 }} />,
  '/inventory/damage-entry': <Inventory sx={{ fontSize: 14 }} />,
  '/inventory/item-history': <Inventory sx={{ fontSize: 14 }} />,
  '/masters/items': <Inventory sx={{ fontSize: 14 }} />,
  '/masters/categories': <Inventory sx={{ fontSize: 14 }} />,
  '/masters/units': <Inventory sx={{ fontSize: 14 }} />,
  '/masters/vendors': <Inventory sx={{ fontSize: 14 }} />,
  '/masters/departments': <Business sx={{ fontSize: 14 }} />,
  '/masters/locations': <Warehouse sx={{ fontSize: 14 }} />,
  '/facilities/room-details': <Warehouse sx={{ fontSize: 14 }} />,
  '/reports': <Assessment sx={{ fontSize: 14 }} />,
  '/financial-year': <Business sx={{ fontSize: 14 }} />,
  '/companies': <Business sx={{ fontSize: 14 }} />,
  '/backup': <Backup sx={{ fontSize: 14 }} />,
  '/settings': <Settings sx={{ fontSize: 14 }} />,
};

function getIconForPath(path: string) {
  if (pathToIcon[path]) return pathToIcon[path];
  if (path.startsWith('/inventory/')) return <Inventory sx={{ fontSize: 14 }} />;
  if (path.startsWith('/masters/')) return <Inventory sx={{ fontSize: 14 }} />;
  return <Assessment sx={{ fontSize: 14 }} />;
}

export default function TabBar() {
  const { tabs, activeTabId, switchTab, removeTab, closeOtherTabs } = useTabs();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const scrollRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{ tabId: string; x: number; y: number } | null>(null);

  const handleWheel = (e: React.WheelEvent) => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft += e.deltaY;
    }
  };

  const handleContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    setContextMenu({ tabId, x: e.clientX, y: e.clientY });
  };

  return (
    <>
      <Box
        onWheel={handleWheel}
        ref={scrollRef}
        sx={{
          display: 'flex',
          alignItems: 'center',
          height: TAB_HEIGHT,
          borderBottom: `1px solid ${isDark ? '#1E293B' : '#E2E8F0'}`,
          backgroundColor: isDark ? '#0B1120' : '#F1F5F9',
          overflow: 'auto',
          flexShrink: 0,
          '&::-webkit-scrollbar': { height: 0 },
          px: 0.5,
          gap: 0.25,
        }}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <Box
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              onContextMenu={(e) => handleContextMenu(e, tab.id)}
              onAuxClick={(e) => {
                if (e.button === 1) {
                  e.preventDefault();
                  if (tab.closable) removeTab(tab.id);
                }
              }}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                height: 28,
                px: 1,
                borderRadius: '6px',
                cursor: 'pointer',
                flexShrink: 0,
                maxWidth: 180,
                transition: 'all 120ms ease-out',
                backgroundColor: isActive
                  ? isDark ? 'rgba(37, 99, 235, 0.15)' : '#FFFFFF'
                  : 'transparent',
                border: `1px solid ${isActive
                  ? isDark ? 'rgba(37, 99, 235, 0.3)' : '#CBD5E1'
                  : 'transparent'}`,
                boxShadow: isActive
                  ? isDark ? '0 1px 3px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.06)'
                  : 'none',
                '&:hover': {
                  backgroundColor: isActive
                    ? isDark ? 'rgba(37, 99, 235, 0.18)' : '#FFFFFF'
                    : isDark ? 'rgba(255,255,255,0.04)' : '#E2E8F0',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', color: isActive ? (isDark ? '#60A5FA' : '#2563EB') : 'text.secondary', flexShrink: 0 }}>
                {getIconForPath(tab.path)}
              </Box>
              <Typography
                noWrap
                sx={{
                  fontSize: '0.6875rem',
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? (isDark ? '#F1F5F9' : '#0F172A') : 'text.secondary',
                  lineHeight: 1.2,
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {tab.title}
              </Typography>
              {tab.closable && (
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTab(tab.id);
                  }}
                  sx={{
                    width: 16, height: 16, p: 0,
                    color: 'text.secondary',
                    '&:hover': { color: 'error.main', backgroundColor: alpha(theme.palette.error.main, 0.1) },
                  }}
                >
                  <Close sx={{ fontSize: 12 }} />
                </IconButton>
              )}
            </Box>
          );
        })}
      </Box>

      <Menu
        open={!!contextMenu}
        onClose={() => setContextMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={contextMenu ? { top: contextMenu.y, left: contextMenu.x } : undefined}
        PaperProps={{
          sx: {
            minWidth: 180,
            border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
            borderRadius: '10px',
            backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
            boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.08)',
          },
        }}
      >
        <MenuItem onClick={() => {
          if (contextMenu) removeTab(contextMenu.tabId);
          setContextMenu(null);
        }}>
          <ListItemIcon><Close sx={{ fontSize: 16 }} /></ListItemIcon>
          <ListItemText primaryTypographyProps={{ fontSize: '0.8125rem' }}>Close Tab</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => {
          if (contextMenu) closeOtherTabs(contextMenu.tabId);
          setContextMenu(null);
        }}>
          <ListItemIcon><ClearAll sx={{ fontSize: 16 }} /></ListItemIcon>
          <ListItemText primaryTypographyProps={{ fontSize: '0.8125rem' }}>Close Other Tabs</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}
