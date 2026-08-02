import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box, Drawer, AppBar, Toolbar, Typography, List, ListItemButton, ListItemIcon,
  ListItemText, IconButton, Avatar, Menu, MenuItem, Collapse,
  Select, FormControl, Tooltip, alpha, useTheme, InputAdornment, TextField,
  Badge, Divider, Chip, CircularProgress,
} from '@mui/material';
import {
  Menu as MenuIcon, Dashboard, Inventory, Assessment, Settings, Backup, Business,
  CalendarMonth, ChevronLeft, ChevronRight, ExpandLess, ExpandMore,
  DarkMode, LightMode, Warehouse, Transform, Inventory2, Search,
  LocalShipping, History, Warning, AssignmentReturn, SearchOff, Hotel,
  Notifications, KeyboardCommandKey, People, Logout,
  Download, Outbox, SwapHoriz, Undo, Tune, ReportProblem, MenuBook,
  InsertChartOutlined, Storage, EventRepeat, Category, Straighten, Storefront, Domain, Place
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCompany } from '../../context/CompanyContext';
import { useThemeMode } from '../../context/ThemeContext';
import { useTabs } from '../../context/TabContext';
import { useAuth } from '../../context/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_MAP } from '../RouteGuards';
import CommandPalette from '../CommandPalette';
import TabBar from '../TabBar';

const DRAWER_WIDTH = 240;
const COLLAPSED_DRAWER_WIDTH = 64;
const APP_BAR_HEIGHT = 56;

interface NavChild {
  text: string;
  path: string;
  icon?: React.ReactNode;
  keywords?: string[];
  permissionKey?: string;
}

interface NavItem {
  text: string;
  icon: React.ReactNode;
  path?: string;
  keywords?: string[];
  section?: string;
  permissionKey?: string;
  children?: NavChild[];
}

const navItems: NavItem[] = [
  { text: 'Dashboard', icon: <Dashboard sx={{ fontSize: 20 }} />, path: '/', keywords: ['home', 'overview'], section: 'Main' },
  {
    text: 'Inventory', icon: <Warehouse sx={{ fontSize: 20 }} />, keywords: ['stock', 'challan', 'receipt', 'issue', 'transfer', 'adjustment', 'damage', 'return', 'history'], section: 'Main',
    children: [
      { text: 'Receipt Challans', path: '/inventory/receipt-challan', icon: <Download sx={{ fontSize: 17 }} />, keywords: ['receive', 'vendor', 'inward', 'aamad'] },
      { text: 'Issue Challans', path: '/inventory/issue-challan', icon: <Outbox sx={{ fontSize: 17 }} />, keywords: ['issue', 'department', 'outward', 'kharch'] },
      { text: 'Transfer Challans', path: '/inventory/transfer-challan', icon: <SwapHoriz sx={{ fontSize: 17 }} />, keywords: ['transfer', 'move'] },
      { text: 'Vendor Returns', path: '/inventory/vendor-return', icon: <Undo sx={{ fontSize: 17, color: '#F59E0B' }} />, keywords: ['return', 'vendor'] },
      { text: 'Stock Adjustments', path: '/inventory/stock-adjustment', icon: <Tune sx={{ fontSize: 17 }} />, keywords: ['adjust', 'correction'] },
      { text: 'Stock Ledger', path: '/inventory/stock-ledger', icon: <MenuBook sx={{ fontSize: 17 }} />, keywords: ['verify', 'count', 'ledger', 'physical'] },
      { text: 'Damage Entry', path: '/inventory/damage-entry', icon: <ReportProblem sx={{ fontSize: 17, color: '#EF4444' }} />, keywords: ['damage', 'broken'] },
      { text: 'Item History', path: '/inventory/item-history', icon: <History sx={{ fontSize: 17 }} />, keywords: ['history', 'log', 'tracking'] },
    ],
  },
  {
    text: 'Masters', icon: <Storage sx={{ fontSize: 20 }} />, keywords: ['master', 'items', 'categories', 'units', 'vendors', 'departments', 'locations'], section: 'Manage', permissionKey: 'manage_masters',
    children: [
      { text: 'Items', path: '/masters/items', icon: <Inventory2 sx={{ fontSize: 17 }} />, keywords: ['item', 'product', 'material'] },
      { text: 'Categories', path: '/masters/categories', icon: <Category sx={{ fontSize: 17 }} />, keywords: ['category', 'group'] },
      { text: 'Units', path: '/masters/units', icon: <Straighten sx={{ fontSize: 17 }} />, keywords: ['unit', 'measurement'] },
      { text: 'Vendors', path: '/masters/vendors', icon: <Storefront sx={{ fontSize: 17 }} />, keywords: ['vendor', 'supplier'] },
      { text: 'Departments', path: '/masters/departments', icon: <Domain sx={{ fontSize: 17 }} />, keywords: ['department', 'team', 'store', 'dharamshala'] },
      { text: 'Locations', path: '/masters/locations', icon: <Place sx={{ fontSize: 17 }} />, keywords: ['location', 'place', 'room'] },
      { text: 'Users', path: '/masters/users', icon: <People sx={{ fontSize: 17 }} />, keywords: ['user', 'account', 'admin', 'role'], permissionKey: 'manage_users' },
    ],
  },
  {
    text: 'Facilities', icon: <Hotel sx={{ fontSize: 20 }} />, keywords: ['facility', 'room', 'dharmshala', 'maintenance'], section: 'Manage',
    children: [
      { text: 'Room Details', path: '/facilities/room-details', icon: <Hotel sx={{ fontSize: 17 }} />, keywords: ['room', 'inventory', 'dharmshala'] },
    ],
  },
  {
    text: 'Settings', icon: <Settings sx={{ fontSize: 20 }} />, keywords: ['settings', 'config', 'preference', 'financial', 'year', 'company', 'backup'], section: 'System',
    children: [
      { text: 'Reports', path: '/reports', icon: <InsertChartOutlined sx={{ fontSize: 17 }} />, keywords: ['report', 'analysis', 'export'] },
      { text: 'Financial Years', path: '/financial-year', icon: <EventRepeat sx={{ fontSize: 17 }} />, keywords: ['financial', 'year', 'fy'], permissionKey: 'manage_financial_year' },
      { text: 'Companies', path: '/companies', icon: <Business sx={{ fontSize: 17 }} />, keywords: ['company', 'business'], permissionKey: 'manage_company' },
      { text: 'Backup', path: '/backup', icon: <Backup sx={{ fontSize: 17 }} />, keywords: ['backup', 'restore', 'database'], permissionKey: 'manage_backup' },
      { text: 'Settings', path: '/settings', icon: <Settings sx={{ fontSize: 17 }} />, keywords: ['settings', 'config', 'preference', 'dark', 'mode'] },
    ],
  },
];

const pathToTitle: Record<string, string> = {};
navItems.forEach((item) => {
  if (item.path) pathToTitle[item.path] = item.text;
  item.children?.forEach((child) => { pathToTitle[child.path] = child.text; });
});

function getTitleForPath(path: string) {
  if (pathToTitle[path]) return pathToTitle[path];
  if (path.includes('/new')) return 'New Entry';
  if (path.match(/\/\d+$/)) return 'Edit Entry';
  return 'Page';
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { company, setCompany, financialYear, setFinancialYear } = useCompany();
  const { darkMode, toggleDarkMode } = useThemeMode();
  const { tabs, activeTabId, addTab, switchTab, closeAllTabs } = useTabs();
  const { currentUser, logout, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const openInTab = useCallback((path: string) => {
    const title = getTitleForPath(path);
    addTab(path, title);
    navigate(path);
  }, [addTab, navigate]);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  useEffect(() => {
    if (activeTab && activeTab.path !== location.pathname) {
      navigate(activeTab.path);
    }
  }, [activeTabId]);

  useEffect(() => {
    const currentTab = tabs.find((t) => t.path === location.pathname);
    if (currentTab && currentTab.id !== activeTabId) {
      switchTab(currentTab.id);
    } else if (!currentTab && location.pathname !== '/') {
      addTab(location.pathname, getTitleForPath(location.pathname));
    }
  }, [location.pathname]);

  const { data: companyList } = useQuery({
    queryKey: ['companies'],
    queryFn: () => window.electronAPI.dbQuery('company', 'findMany', { where: { isActive: true }, orderBy: { name: 'asc' } }),
  });

  const { data: fyList } = useQuery({
    queryKey: ['financialYears', company?.id],
    queryFn: () => window.electronAPI.dbQuery('financialYear', 'findMany', { where: { companyId: company?.id, isClosed: false }, orderBy: { startDate: 'desc' } }),
    enabled: !!company?.id,
  });

  useEffect(() => {
    if (companyList && companyList.length > 0 && !company) setCompany(companyList[0]);
  }, [companyList, company, setCompany]);

  useEffect(() => {
    if (fyList && fyList.length > 0 && !financialYear) setFinancialYear(fyList[0]);
  }, [fyList, financialYear, setFinancialYear]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K — Command Palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
      }
      // Cmd/Ctrl + N — New Receipt Challan
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        openInTab('/inventory/receipt-challan/new');
      }
      // Cmd/Ctrl + D — Dashboard
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault();
        openInTab('/');
      }
      // Cmd/Ctrl + , — Settings
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        openInTab('/settings');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openInTab]);

  // Auto-expand parent menu for active route
  useEffect(() => {
    navItems.forEach((item) => {
      if (item.children?.some((c) => location.pathname.startsWith(c.path))) {
        setOpenMenus((prev) => ({ ...prev, [item.text]: true }));
      }
    });
  }, [location.pathname]);

  const toggleMenu = useCallback((text: string) => setOpenMenus((prev) => ({ ...prev, [text]: !prev[text] })), []);
  const isActive = useCallback((path: string) => location.pathname === path, [location.pathname]);
  const isParentActive = useCallback((children?: NavChild[]) => children?.some((c) => location.pathname.startsWith(c.path)), [location.pathname]);

  const filteredItems = useMemo(() => {
    return navItems
      .filter((item) => !item.permissionKey || hasPermission(item.permissionKey))
      .map((item) => ({
        ...item,
        children: item.children?.filter(
          (child) => !child.permissionKey || hasPermission(child.permissionKey),
        ),
      }));
  }, [hasPermission]);

  const sections = useMemo(() => {
    const grouped: Record<string, NavItem[]> = {};
    filteredItems.forEach((item) => {
      const section = item.section || 'Main';
      if (!grouped[section]) grouped[section] = [];
      grouped[section].push(item);
    });
    return grouped;
  }, [filteredItems]);

  const sectionOrder = ['Main', 'Manage', 'System'];

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />

      {/* Glassmorphism Top App Bar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          height: APP_BAR_HEIGHT,
          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.8)' : 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderBottom: `1px solid ${isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(226, 232, 240, 0.8)'}`,
          color: isDark ? '#F1F5F9' : '#0F172A',
        }}
      >
        <Toolbar sx={{ px: { xs: 1.5, sm: 2.5 }, minHeight: `${APP_BAR_HEIGHT}px !important`, gap: 1 }}>
          {/* Hamburger */}
          <Tooltip title={drawerOpen ? 'Collapse sidebar' : 'Expand sidebar'} arrow>
            <IconButton
            edge="start"
            onClick={() => setDrawerOpen(!drawerOpen)}
            sx={{
              color: isDark ? '#94A3B8' : '#64748B',
              width: 36,
              height: 36,
              borderRadius: '10px',
              '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9' },
            }}
          >
            {drawerOpen ? <ChevronLeft sx={{ fontSize: 20 }} /> : <MenuIcon sx={{ fontSize: 20 }} />}
          </IconButton>
          </Tooltip>

          {/* Brand */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mr: 1.5 }}>
            <Box sx={{
              width: 34, height: 34, borderRadius: '10px',
              background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
              flexShrink: 0,
            }}>
              <Inventory2 sx={{ fontSize: 17, color: '#FFFFFF' }} />
            </Box>
            <Box sx={{ display: { xs: 'none', sm: 'block' }, minWidth: 0 }}>
              <Typography variant="subtitle1" noWrap sx={{
                fontWeight: 800, lineHeight: 1.2, fontSize: '0.875rem',
                color: 'text.primary', letterSpacing: '-0.02em',
              }}>
                Mahaveerji
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography variant="caption" sx={{
                  fontSize: '0.5625rem', lineHeight: 1, letterSpacing: '0.06em',
                  textTransform: 'uppercase', color: 'text.secondary', fontWeight: 600,
                }}>
                  Inventory System
                </Typography>
              </Box>
            </Box>
          </Box>

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: isDark ? 'rgba(51,65,85,0.4)' : 'rgba(226,232,240,0.8)' }} />

          {/* Company & FY Selectors */}
          <Box sx={{ display: { xs: 'none', lg: 'flex' }, alignItems: 'center', gap: 0.75, flexGrow: 0 }}>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <Select
                native
                value={company?.id || ''}
                onChange={(e) => {
                  const c = companyList?.find((c: any) => c.id === Number(e.target.value));
                  setCompany(c || null);
                  setFinancialYear(null);
                }}
                sx={{
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
                  borderRadius: '8px',
                  px: 0.75,
                  height: 34,
                  color: 'text.secondary',
                  '& .MuiSvgIcon-root': { color: 'text.secondary', fontSize: 18 },
                  '& .MuiNativeSelect-select': { py: 0.5, pr: 2.5 },
                  '& fieldset': { border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`, borderRadius: '8px' },
                  '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9' },
                }}
              >
                {companyList?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 90 }}>
              <Select
                native
                value={financialYear?.id || ''}
                onChange={(e) => {
                  const fy = fyList?.find((f: any) => f.id === Number(e.target.value));
                  setFinancialYear(fy || null);
                }}
                sx={{
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
                  borderRadius: '8px',
                  px: 0.75,
                  height: 34,
                  color: 'text.secondary',
                  '& .MuiSvgIcon-root': { color: 'text.secondary', fontSize: 18 },
                  '& .MuiNativeSelect-select': { py: 0.5, pr: 2.5 },
                  '& fieldset': { border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`, borderRadius: '8px' },
                  '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9' },
                }}
              >
                {fyList?.map((fy: any) => <option key={fy.id} value={fy.id}>{fy.label}</option>)}
              </Select>
            </FormControl>
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          {/* Global Search Trigger */}
          <Tooltip title="Search pages & actions (⌘K)" arrow>
            <Box
              onClick={() => setCmdOpen(true)}
              sx={{
                display: { xs: 'none', sm: 'flex' },
                alignItems: 'center',
                gap: 1,
                px: 1.5,
                py: 0.625,
                borderRadius: '10px',
                border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
                backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC',
                cursor: 'pointer',
                transition: 'all 150ms ease-out',
                minWidth: 240,
                '&:hover': {
                  borderColor: isDark ? '#475569' : '#CBD5E1',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F1F5F9',
                },
              }}
            >
            <Search sx={{ fontSize: 15, color: isDark ? '#64748B' : '#94A3B8' }} />
            <Typography variant="body2" sx={{ fontSize: '0.8125rem', color: isDark ? '#64748B' : '#94A3B8', fontWeight: 400, flex: 1 }}>
              Search...
            </Typography>
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 0.25,
              fontSize: '10px', fontFamily: '"Inter", monospace',
              color: isDark ? '#64748B' : '#94A3B8',
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
              border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
              borderRadius: '5px', padding: '2px 5px', fontWeight: 600,
            }}>
              <KeyboardCommandKey sx={{ fontSize: 10 }} />K
            </Box>
          </Box>
          </Tooltip>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Tooltip title="Notifications" arrow>
              <IconButton sx={{
                color: isDark ? '#94A3B8' : '#64748B',
                width: 36, height: 36, borderRadius: '10px',
                '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9' },
              }}>
                <Badge badgeContent={3} color="error" sx={{ '& .MuiBadge-badge': { fontSize: '0.6rem', height: 16, minWidth: 16 } }}>
                  <Notifications sx={{ fontSize: 19 }} />
                </Badge>
              </IconButton>
            </Tooltip>

            <Tooltip title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'} arrow>
              <IconButton
                onClick={toggleDarkMode}
                sx={{
                  color: isDark ? '#94A3B8' : '#64748B',
                  width: 36, height: 36, borderRadius: '10px',
                  transition: 'all 200ms ease-out',
                  '&:hover': {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
                    transform: 'rotate(30deg)',
                  },
                }}
              >
                {darkMode ? <LightMode sx={{ fontSize: 19 }} /> : <DarkMode sx={{ fontSize: 19 }} />}
              </IconButton>
            </Tooltip>

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: isDark ? 'rgba(51,65,85,0.4)' : 'rgba(226,232,240,0.8)' }} />

            {/* User Profile */}
            <IconButton
              onClick={(e) => setAnchorEl(e.currentTarget)}
              sx={{
                p: 0.5,
                borderRadius: '10px',
                '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F1F5F9' },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 0.75, py: 0.375 }}>
                <Avatar sx={{
                  width: 30, height: 30,
                  background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                  color: '#FFFFFF', fontSize: '0.6875rem', fontWeight: 700,
                }}>
                  {currentUser?.fullName?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'U'}
                </Avatar>
                <Box sx={{ display: { xs: 'none', md: 'block' }, lineHeight: 1.2 }}>
                  <Typography variant="body2" sx={{
                    fontWeight: 600, fontSize: '0.75rem', color: 'text.primary',
                    whiteSpace: 'nowrap', textTransform: 'capitalize'
                  }}>
                    {currentUser?.fullName || currentUser?.username || 'Admin User'}
                  </Typography>
                  <Typography variant="caption" sx={{
                    fontSize: '0.625rem', color: 'text.secondary',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>
                    {currentUser?.role || ''}
                  </Typography>
                </Box>
              </Box>
            </IconButton>

            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={() => setAnchorEl(null)}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              PaperProps={{
                sx: {
                  mt: 1, minWidth: 180,
                  border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
                  borderRadius: '12px',
                  backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                  boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.4)' : '0 10px 30px rgba(0,0,0,0.08)',
                },
              }}
            >
              <MenuItem disabled sx={{ opacity: 0.7, py: 1 }}>
                <Typography variant="body2" color="text.secondary" fontWeight={500} textTransform="capitalize">
                  {currentUser?.fullName || currentUser?.username || 'Admin User'} ({currentUser?.role || 'Administrator'})
                </Typography>
              </MenuItem>
              <Divider sx={{ my: 0.5 }} />
              <MenuItem 
                onClick={() => {
                  setAnchorEl(null);
                  const keys = ['reports_activeReport','reports_startDate','reports_endDate','reports_selectedItemId','reports_selectedCategoryId','reports_selectedDepartment','reports_selectedVendor','reports_selectedLocation','reports_selectedTxType','reports_selectedAdjustmentType','reports_selectedStatus','reports_selectedAuditAction','reports_selectedAuditTable','reports_searchText','reports_lowStockOnly','favoriteItems','recentIssueItems','recentReceiptItems','selectedCompany','selectedFinancialYear'];
                  keys.forEach(k => { try { localStorage.removeItem(k); } catch {} });
                  queryClient.cancelQueries();
                  closeAllTabs();
                  logout();
                }}
                sx={{
                  color: '#EF4444',
                  mx: 1,
                  mb: 1,
                  borderRadius: '8px',
                  '&:hover': {
                    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.08)',
                  }
                }}
              >
                <ListItemIcon sx={{ color: 'inherit', minWidth: 32 }}><Logout fontSize="small" /></ListItemIcon>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>Logout</Typography>
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Sidebar */}
      <Drawer
        variant="persistent"
        open={drawerOpen}
        sx={{
          width: drawerOpen ? DRAWER_WIDTH : COLLAPSED_DRAWER_WIDTH,
          flexShrink: 0,
          transition: 'width 200ms cubic-bezier(0.4, 0, 0.2, 1)',
          '& .MuiDrawer-paper': {
            width: drawerOpen ? DRAWER_WIDTH : COLLAPSED_DRAWER_WIDTH,
            transition: 'width 200ms cubic-bezier(0.4, 0, 0.2, 1)',
            overflowX: 'hidden',
            backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
            borderRight: `1px solid ${isDark ? '#1E293B' : '#F1F5F9'}`,
          },
        }}
      >
        <Toolbar sx={{ minHeight: `${APP_BAR_HEIGHT}px !important` }} />
        <Box sx={{
          overflowY: 'auto',
          overflowX: 'hidden',
          pt: 1.5,
          pb: 2,
          px: drawerOpen ? 1 : 0.5,
          flex: 1,
          '&::-webkit-scrollbar': { width: 4 },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': { background: isDark ? '#334155' : '#E2E8F0', borderRadius: 4 },
          '&:hover::-webkit-scrollbar-thumb': { background: isDark ? '#475569' : '#CBD5E1' },
        }}>
          {sectionOrder.map((sectionName) => {
            const items = sections[sectionName];
            if (!items || items.length === 0) return null;
            return (
              <Box key={sectionName} sx={{ mb: 2 }}>
                {drawerOpen && (
                  <Typography
                    variant="caption"
                    sx={{
                      px: 1.25, mb: 0.5, display: 'block',
                      fontWeight: 700, fontSize: '0.5625rem',
                      letterSpacing: '0.1em', textTransform: 'uppercase',
                      color: isDark ? '#475569' : '#CBD5E1',
                    }}
                  >
                    {sectionName}
                  </Typography>
                )}
                <List component="nav" disablePadding>
                  {items.map((item) => (
                    <React.Fragment key={item.text}>
                      {item.children ? (
                        <>
                          <ListItemButton
                            onClick={() => drawerOpen && toggleMenu(item.text)}
                            selected={isParentActive(item.children)}
                            sx={{
                              borderRadius: '10px',
                              mb: 0.125,
                              minHeight: 38,
                              px: drawerOpen ? 1 : 0,
                              justifyContent: drawerOpen ? 'initial' : 'center',
                              transition: 'all 120ms ease-out',
                              '&.Mui-selected': {
                                backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
                                '&:hover': { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.14)' : '#DBEAFE' },
                              },
                              '&:hover': {
                                backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
                              },
                            }}
                          >
                            <ListItemIcon sx={{
                              minWidth: 0,
                              mr: drawerOpen ? 1.25 : 0,
                              justifyContent: 'center',
                              color: isParentActive(item.children)
                                ? (isDark ? '#60A5FA' : '#2563EB')
                                : (isDark ? '#64748B' : '#94A3B8'),
                              transition: 'color 120ms ease-out',
                            }}>
                              {item.icon}
                            </ListItemIcon>
                            {drawerOpen && (
                              <>
                                <ListItemText
                                  primary={item.text}
                                  primaryTypographyProps={{
                                    fontSize: '0.8125rem',
                                    fontWeight: isParentActive(item.children) ? 600 : 500,
                                    color: isParentActive(item.children)
                                      ? (isDark ? '#F1F5F9' : '#0F172A')
                                      : (isDark ? '#CBD5E1' : '#475569'),
                                  }}
                                />
                                {openMenus[item.text]
                                  ? <ExpandLess sx={{ fontSize: 16, color: isDark ? '#475569' : '#CBD5E1' }} />
                                  : <ExpandMore sx={{ fontSize: 16, color: isDark ? '#475569' : '#CBD5E1' }} />
                                }
                              </>
                            )}
                          </ListItemButton>
                          {drawerOpen && (
                            <Collapse in={openMenus[item.text]} timeout="auto" unmountOnExit>
                              <List component="div" disablePadding sx={{ pl: 0 }}>
                                {item.children.map((child) => (
                                  <ListItemButton
                                    key={child.path}
                                    sx={{
                                      pl: 1.5,
                                      pr: 1.25,
                                      py: 0.375,
                                      borderRadius: '8px',
                                      mb: 0.125,
                                      minHeight: 34,
                                      position: 'relative',
                                      transition: 'all 120ms ease-out',
                                      '&.Mui-selected': {
                                        backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
                                        '&::before': {
                                          content: '""',
                                          position: 'absolute',
                                          left: 0,
                                          top: '50%',
                                          transform: 'translateY(-50%)',
                                          width: 3,
                                          height: '55%',
                                          borderRadius: '0 3px 3px 0',
                                          backgroundColor: isDark ? '#3B82F6' : '#2563EB',
                                        },
                                      },
                                      '&:hover': {
                                        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
                                      },
                                    }}
                                    selected={isActive(child.path)}
                                    onClick={() => openInTab(child.path)}
                                  >
                                    {child.icon && (
                                      <ListItemIcon sx={{
                                        minWidth: 26,
                                        mr: 0.75,
                                        color: isActive(child.path)
                                          ? (isDark ? '#60A5FA' : '#2563EB')
                                          : (isDark ? '#475569' : '#94A3B8'),
                                        transition: 'color 120ms ease-out',
                                      }}>
                                        {child.icon}
                                      </ListItemIcon>
                                    )}
                                    <ListItemText
                                      primary={child.text}
                                      primaryTypographyProps={{
                                        fontSize: '0.75rem',
                                        fontWeight: isActive(child.path) ? 600 : 400,
                                        color: isActive(child.path)
                                          ? (isDark ? '#F1F5F9' : '#0F172A')
                                          : (isDark ? '#94A3B8' : '#64748B'),
                                      }}
                                    />
                                  </ListItemButton>
                                ))}
                              </List>
                            </Collapse>
                          )}
                        </>
                      ) : (
                        <ListItemButton
                          selected={isActive(item.path!)}
                          onClick={() => openInTab(item.path!)}
                          sx={{
                            borderRadius: '10px',
                            mb: 0.125,
                            minHeight: 38,
                            px: drawerOpen ? 1 : 0,
                            justifyContent: drawerOpen ? 'initial' : 'center',
                            transition: 'all 120ms ease-out',
                            '&.Mui-selected': {
                              backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
                              '&:hover': { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.14)' : '#DBEAFE' },
                            },
                            '&:hover': {
                              backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
                            },
                          }}
                        >
                          <ListItemIcon sx={{
                            minWidth: 0,
                            mr: drawerOpen ? 1.25 : 0,
                            justifyContent: 'center',
                            color: isActive(item.path!)
                              ? (isDark ? '#60A5FA' : '#2563EB')
                              : (isDark ? '#64748B' : '#94A3B8'),
                            transition: 'color 120ms ease-out',
                          }}>
                            {item.icon}
                          </ListItemIcon>
                          {drawerOpen && (
                            <ListItemText
                              primary={item.text}
                              primaryTypographyProps={{
                                fontSize: '0.8125rem',
                                fontWeight: isActive(item.path!) ? 600 : 500,
                                color: isActive(item.path!)
                                  ? (isDark ? '#F1F5F9' : '#0F172A')
                                  : (isDark ? '#CBD5E1' : '#475569'),
                              }}
                            />
                          )}
                        </ListItemButton>
                      )}
                    </React.Fragment>
                  ))}
                </List>
              </Box>
            );
          })}
        </Box>

        {/* Sidebar Footer - Version Info */}
        {drawerOpen && (
          <Box sx={{
            p: 1.25,
            borderTop: `1px solid ${isDark ? '#1E293B' : '#F1F5F9'}`,
          }}>
            <Box sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 0.5, py: 0.5,
            }}>
              <Box sx={{
                width: 6, height: 6, borderRadius: '50%',
                backgroundColor: '#22C55E',
              }} />
              <Typography variant="caption" sx={{
                fontSize: '0.625rem', color: isDark ? '#475569' : '#CBD5E1',
                fontWeight: 500,
              }}>
                v2.0.0 • StockFlow Pro
              </Typography>
            </Box>
          </Box>
        )}
      </Drawer>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          mt: `${APP_BAR_HEIGHT}px`,
          height: `calc(100vh - ${APP_BAR_HEIGHT}px)`,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
          transition: 'background-color 0.3s ease',
        }}
      >
        <TabBar />
        <Box
          sx={{
            flex: 1,
            overflow: 'auto',
            '&::-webkit-scrollbar': { width: 5 },
            '&::-webkit-scrollbar-track': { background: 'transparent' },
            '&::-webkit-scrollbar-thumb': { background: isDark ? '#334155' : '#CBD5E1', borderRadius: 3 },
            '&::-webkit-scrollbar-thumb:hover': { background: isDark ? '#475569' : '#94A3B8' },
          }}
        >
          <Box sx={{ p: { xs: 1.5, sm: 2, md: 2.5 } }}>
            {children}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
