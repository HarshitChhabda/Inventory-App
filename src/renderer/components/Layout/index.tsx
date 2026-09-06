import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Box, AppBar, Toolbar, Typography, List, ListItemButton, ListItemIcon,
  ListItemText, IconButton, Avatar, Menu, MenuItem, Popper, Paper,
  Select, FormControl, Tooltip, alpha, useTheme, InputAdornment, TextField,
  Badge, Divider, Chip, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Button, ClickAwayListener,
} from '@mui/material';
import {
  Menu as MenuIcon, Dashboard, Inventory, Assessment, Settings, Backup, Business,
  CalendarMonth, ChevronLeft, ChevronRight,
  DarkMode, LightMode, Warehouse, Inventory2, Search,
  LocalShipping, History, Warning, AssignmentReturn, Hotel,
  Notifications, KeyboardCommandKey, People, Logout,
  Download, Outbox, SwapHoriz, Undo, Tune, ReportProblem, MenuBook,
  Storage, EventRepeat, Straighten, Storefront, Domain, Place, Receipt,
  Shield, Security, FactCheck, Policy,
  Assignment, Add, List as ListIcon, ShoppingCart, Build, Schedule, HelpOutline,
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
import NotificationPanel from '../NotificationPanel';
import UnsavedChangesDialog from '../UnsavedChangesDialog';

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
  // ── Main ──────────────────────────────────────────
  { text: 'Dashboard', icon: <Dashboard sx={{ fontSize: 20 }} />, path: '/', keywords: ['home', 'overview'], section: 'Main' },
  { text: 'Reports', icon: <Assessment sx={{ fontSize: 20 }} />, path: '/reports', keywords: ['report', 'analysis', 'export'], section: 'Main' },
  {
    text: 'Inventory', icon: <Warehouse sx={{ fontSize: 20 }} />, keywords: ['stock', 'challan', 'receipt', 'issue', 'transfer', 'adjustment', 'damage', 'return', 'history', 'movement', 'demand', 'receive'], section: 'Main',
    children: [
      { text: 'Material Operations', path: '/inventory/movement', icon: <SwapHoriz sx={{ fontSize: 17, color: '#2563EB' }} />, keywords: ['movement', 'issue', 'transfer', 'consume', 'install', 'demand', 'receive'] },
      { text: 'Store Issue', path: '/inventory/issue-challan', icon: <Outbox sx={{ fontSize: 17 }} />, keywords: ['issue', 'outward', 'store'] },
      { text: 'Store Transfer', path: '/inventory/transfer-challan', icon: <SwapHoriz sx={{ fontSize: 17 }} />, keywords: ['transfer', 'move', 'store'] },
      { text: 'Stock Ledger', path: '/inventory/stock-ledger', icon: <MenuBook sx={{ fontSize: 17 }} />, keywords: ['verify', 'count', 'ledger', 'physical'] },
      { text: 'Item History', path: '/inventory/item-history', icon: <History sx={{ fontSize: 17 }} />, keywords: ['history', 'log', 'tracking'] },
    ],
  },
  // ── Operations ────────────────────────────────────
  {
    text: 'Requisitions', icon: <Assignment sx={{ fontSize: 20 }} />, keywords: ['requisition', 'request', 'approval', 'workflow'], section: 'Operations',
    children: [
      { text: 'New Request', path: '/requisition/create', icon: <Add sx={{ fontSize: 17 }} />, keywords: ['create', 'new', 'request'] },
      { text: 'All Requests', path: '/requisition/list', icon: <ListIcon sx={{ fontSize: 17 }} />, keywords: ['list', 'all', 'search'] },
      { text: 'Workflow Config', path: '/requisition/workflow', icon: <Settings sx={{ fontSize: 17 }} />, keywords: ['workflow', 'config', 'approval', 'level'] },
    ],
  },
  {
    text: 'Procurement', icon: <LocalShipping sx={{ fontSize: 20 }} />, keywords: ['procurement', 'vendor', 'purchase', 'po', 'grn'], section: 'Operations',
    children: [
      { text: 'Dashboard', path: '/procurement/dashboard', icon: <Assessment sx={{ fontSize: 17 }} />, keywords: ['dashboard', 'overview', 'stats'] },
      { text: 'Vendor Master', path: '/procurement/vendors', icon: <Business sx={{ fontSize: 17 }} />, keywords: ['vendor', 'master', 'profile'] },
      { text: 'Purchase Orders', path: '/procurement/po', icon: <ShoppingCart sx={{ fontSize: 17 }} />, keywords: ['purchase', 'order', 'po'] },
      { text: 'Goods Receipt', path: '/procurement/grn', icon: <LocalShipping sx={{ fontSize: 17 }} />, keywords: ['goods', 'receipt', 'grn', 'qc'] },
    ],
  },
  {
    text: 'Maintenance', icon: <Build sx={{ fontSize: 20 }} />, keywords: ['maintenance', 'service', 'repair', 'amc', 'work order'], section: 'Operations',
    children: [
      { text: 'Dashboard', path: '/maintenance/dashboard', icon: <Assessment sx={{ fontSize: 17 }} />, keywords: ['dashboard', 'overview', 'stats'] },
      { text: 'Service Requests', path: '/maintenance/requests', icon: <Assignment sx={{ fontSize: 17 }} />, keywords: ['service', 'request', 'issue'] },
      { text: 'Work Orders', path: '/maintenance/workorders', icon: <Build sx={{ fontSize: 17 }} />, keywords: ['work', 'order', 'repair'] },
      { text: 'AMC & Schedules', path: '/maintenance/amc', icon: <Schedule sx={{ fontSize: 17 }} />, keywords: ['amc', 'warranty', 'schedule'] },
    ],
  },
  // ── Setup ─────────────────────────────────────────
  {
    text: 'Masters', icon: <Storage sx={{ fontSize: 20 }} />, keywords: ['master', 'items', 'categories', 'units', 'vendors', 'departments', 'locations'], section: 'Setup', permissionKey: 'manage_masters',
    children: [
      { text: 'Items', path: '/masters/items', icon: <Inventory2 sx={{ fontSize: 17 }} />, keywords: ['item', 'product', 'material'] },
      { text: 'Units', path: '/masters/units', icon: <Straighten sx={{ fontSize: 17 }} />, keywords: ['unit', 'measurement'] },
      { text: 'Departments', path: '/masters/departments', icon: <Domain sx={{ fontSize: 17 }} />, keywords: ['department', 'team', 'store', 'dharmshala'] },
      { text: 'Locations', path: '/masters/locations', icon: <Place sx={{ fontSize: 17 }} />, keywords: ['location', 'place', 'room'] },
      { text: 'Users', path: '/masters/users', icon: <People sx={{ fontSize: 17 }} />, keywords: ['user', 'account', 'admin', 'role'], permissionKey: 'manage_users' },
    ],
  },
  {
    text: 'Enterprise', icon: <Business sx={{ fontSize: 20 }} />, keywords: ['enterprise', 'store', 'multi-store', 'configuration'], section: 'Setup',
    children: [
      { text: 'Store Master', path: '/enterprise/stores', icon: <Storefront sx={{ fontSize: 17 }} />, keywords: ['store', 'main', 'department', 'dharmshala'] },
      { text: 'Store Stock', path: '/enterprise/stock', icon: <Inventory sx={{ fontSize: 17 }} />, keywords: ['stock', 'balance', 'store-wise'] },
      { text: 'Configuration', path: '/enterprise/configuration', icon: <Settings sx={{ fontSize: 17 }} />, keywords: ['config', 'settings', 'rules'], permissionKey: 'manage_settings' },
    ],
  },
  {
    text: 'Facilities', icon: <Hotel sx={{ fontSize: 20 }} />, keywords: ['facility', 'room', 'dharmshala', 'maintenance'], section: 'Setup',
    children: [
      { text: 'Room Details', path: '/facilities/room-details', icon: <Hotel sx={{ fontSize: 17 }} />, keywords: ['room', 'inventory', 'dharmshala'] },
    ],
  },
  {
    text: 'Assets', icon: <Inventory2 sx={{ fontSize: 20 }} />, keywords: ['asset', 'digital', 'qr', 'warranty', 'amc', 'repair', 'health'], section: 'Setup',
    children: [
      { text: 'Asset Registry', path: '/assets/registry', icon: <Inventory2 sx={{ fontSize: 17 }} />, keywords: ['asset', 'digital', 'qr', 'register'] },
      { text: 'Asset Installations', path: '/assets/installations', icon: <Hotel sx={{ fontSize: 17 }} />, keywords: ['install', 'room', 'department'] },
    ],
  },
  // ── System ────────────────────────────────────────
  {
    text: 'Settings', icon: <Settings sx={{ fontSize: 20 }} />, keywords: ['settings', 'config', 'preference', 'financial', 'year', 'company', 'backup'], section: 'System',
    children: [
      { text: 'Financial Years', path: '/financial-year', icon: <EventRepeat sx={{ fontSize: 17 }} />, keywords: ['financial', 'year', 'fy'], permissionKey: 'manage_financial_year' },
      { text: 'Companies', path: '/companies', icon: <Business sx={{ fontSize: 17 }} />, keywords: ['company', 'business'], permissionKey: 'manage_company' },
      { text: 'Backup', path: '/backup', icon: <Backup sx={{ fontSize: 17 }} />, keywords: ['backup', 'restore', 'database'], permissionKey: 'manage_backup' },
      { text: 'Settings', path: '/settings', icon: <Settings sx={{ fontSize: 17 }} />, keywords: ['settings', 'config', 'preference', 'dark', 'mode'] },
      { text: 'Help Center', path: '/help-center', icon: <HelpOutline sx={{ fontSize: 17 }} />, keywords: ['help', 'guide', 'tutorial', 'howto'] },
    ],
  },
  {
    text: 'Administration', icon: <Shield sx={{ fontSize: 20 }} />, keywords: ['admin', 'security', 'audit', 'roles', 'permissions', 'integrity'], section: 'System',
    children: [
      { text: 'Audit Logs', path: '/admin/audit', icon: <FactCheck sx={{ fontSize: 17 }} />, keywords: ['audit', 'log', 'track', 'history'], permissionKey: 'audit:view' },
      { text: 'Roles & Permissions', path: '/admin/roles', icon: <People sx={{ fontSize: 17 }} />, keywords: ['roles', 'permissions', 'rbac', 'access'], permissionKey: 'user:create' },
      { text: 'Security', path: '/admin/security', icon: <Security sx={{ fontSize: 17 }} />, keywords: ['security', 'password', 'session', 'lock'], permissionKey: 'settings:edit' },
      { text: 'Data Integrity', path: '/admin/integrity', icon: <Policy sx={{ fontSize: 17 }} />, keywords: ['integrity', 'validation', 'audit', 'consistency'], permissionKey: 'audit:view' },
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
  if (path.includes('/new')) {
    const parent = path.replace(/\/new$/, '');
    return `New ${pathToTitle[parent] || 'Entry'}`;
  }
  const numMatch = path.match(/\/(\d+)$/);
  if (numMatch) {
    const parent = path.replace(/\/\d+$/, '');
    const base = pathToTitle[parent] || 'Entry';
    return `${base} #${numMatch[1]}`;
  }
  return 'Page';
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { company, setCompany, financialYear, setFinancialYear } = useCompany();
  const { darkMode, toggleDarkMode } = useThemeMode();
  const { tabs, activeTabId, addTab, switchTab, closeAllTabs, removeTab, nextTab, prevTab, goToTab, hasDirtyTabs, setNavigateFn } = useTabs();
  const { currentUser, logout, hasPermission } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    setNavigateFn(navigate);
  }, [setNavigateFn, navigate]);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const effectiveExpanded = drawerOpen || sidebarHovered;
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    try {
      const saved = sessionStorage.getItem('sidebarCollapsedSections');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [hoveredItemEl, setHoveredItemEl] = useState<HTMLElement | null>(null);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup hover timer on unmount
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  // Confirmation dialogs for company/FY change
  const [showCompanyConfirm, setShowCompanyConfirm] = useState(false);
  const [showFyConfirm, setShowFyConfirm] = useState(false);
  const [pendingCompany, setPendingCompany] = useState<any>(null);
  const [pendingFy, setPendingFy] = useState<any>(null);

  // Tab close confirmation state
  const [showTabCloseConfirm, setShowTabCloseConfirm] = useState(false);
  const [pendingTabCloseId, setPendingTabCloseId] = useState<string | null>(null);
  const [pendingCloseAll, setPendingCloseAll] = useState(false);

  // Notification panel state
  const [notifAnchorEl, setNotifAnchorEl] = useState<null | HTMLElement>(null);
  const notifOpen = Boolean(notifAnchorEl);
  const [notifUnreadCount, setNotifUnreadCount] = useState(0);

  const openInTab = useCallback((path: string) => {
    const title = getTitleForPath(path);
    addTab(path, title);
    navigate(path);
  }, [addTab, navigate]);

  useEffect(() => {
    const currentTab = tabs.find((t) => t.path === location.pathname);
    if (currentTab && currentTab.id !== activeTabId) {
      switchTab(currentTab.id);
    }
  }, [location.pathname]);

  const { data: companyList } = useQuery({
    queryKey: ['companies', 'active'],
    queryFn: () => window.electronAPI.dbQuery('company', 'findMany', { where: { isActive: true }, orderBy: { name: 'asc' } }),
  });

  // Validate active company is still active
  useEffect(() => {
    if (company && companyList && companyList.length > 0) {
      const stillActive = companyList.some((c: any) => c.id === company.id);
      if (!stillActive) {
        setCompany(null);
        setFinancialYear(null);
      }
    }
  }, [companyList]);

  const { data: fyList } = useQuery({
    queryKey: ['financialYears', company?.id],
    queryFn: () => window.electronAPI.findAllFY(company?.id),
    enabled: !!company?.id,
  });

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl + K — Command Palette
      if (mod && e.key === 'k') {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
        return;
      }
      // Cmd/Ctrl + N — New Receipt Challan
      if (mod && e.key === 'n') {
        e.preventDefault();
        openInTab('/procurement/grn/new');
        return;
      }
      // Cmd/Ctrl + D — Dashboard
      if (mod && e.key === 'd') {
        e.preventDefault();
        openInTab('/');
        return;
      }
      // Cmd/Ctrl + , — Settings
      if (mod && e.key === ',') {
        e.preventDefault();
        openInTab('/settings');
        return;
      }

      // Tab shortcuts (Ctrl only, not Cmd)
      if (e.ctrlKey && !e.metaKey) {
        // Ctrl + Tab — Next tab
        if (e.key === 'Tab' && !e.shiftKey) {
          e.preventDefault();
          nextTab();
          return;
        }
        // Ctrl + Shift + Tab — Previous tab
        if (e.key === 'Tab' && e.shiftKey) {
          e.preventDefault();
          prevTab();
          return;
        }
        // Ctrl + W — Close active tab
        if (e.key === 'w') {
          e.preventDefault();
          const active = tabs.find((t) => t.id === activeTabId);
          if (active?.closable) {
            if (active.dirty) {
              setPendingTabCloseId(activeTabId);
              setShowTabCloseConfirm(true);
            } else {
              const nextPath = removeTab(activeTabId);
              navigate(nextPath);
            }
          }
          return;
        }
        // Ctrl + Shift + W — Close all tabs
        if (e.key === 'W') {
          e.preventDefault();
          if (hasDirtyTabs()) {
            setPendingCloseAll(true);
            setShowTabCloseConfirm(true);
          } else {
            const nextPath = closeAllTabs();
            navigate(nextPath);
          }
          return;
        }
        // Ctrl + 1..9 — Jump to tab by position
        if (e.key >= '1' && e.key <= '9') {
          e.preventDefault();
          goToTab(parseInt(e.key) - 1);
          return;
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openInTab, nextTab, prevTab, goToTab, removeTab, closeAllTabs, tabs, activeTabId]);

  // Warn before leaving app if there are dirty tabs
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasDirtyTabs()) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasDirtyTabs]);

  // Auto-expand parent menu for active route
  useEffect(() => {
    navItems.forEach((item) => {
      if (item.children?.some((c) => location.pathname.startsWith(c.path))) {
        setOpenMenus((prev) => ({ ...prev, [item.text]: true }));
      }
    });
  }, [location.pathname]);

  // Auto-collapse sidebar on mobile resize
  useEffect(() => {
    const handleResize = () => {};
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleMenu = useCallback((text: string) => setOpenMenus((prev) => ({ ...prev, [text]: !prev[text] })), []);

  const toggleSection = useCallback((sectionName: string) => {
    setCollapsedSections((prev) => {
      const next = { ...prev, [sectionName]: !prev[sectionName] };
      try { sessionStorage.setItem('sidebarCollapsedSections', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);
  const isActive = useCallback((path: string) => location.pathname === path, [location.pathname]);
  const isParentActive = useCallback((children?: NavChild[]) => children?.some((c) => location.pathname.startsWith(c.path)), [location.pathname]);

  const confirmCompanyChange = useCallback(() => {
    if (pendingCompany) {
      setCompany(pendingCompany);
      setFinancialYear(null);
    }
    setShowCompanyConfirm(false);
    setPendingCompany(null);
  }, [pendingCompany, setCompany, setFinancialYear]);

  const confirmFyChange = useCallback(() => {
    if (pendingFy) {
      setFinancialYear(pendingFy);
    }
    setShowFyConfirm(false);
    setPendingFy(null);
  }, [pendingFy, setFinancialYear]);

  const handleTabCloseConfirm = useCallback(() => {
    if (pendingCloseAll) {
      const nextPath = closeAllTabs();
      navigate(nextPath);
    } else if (pendingTabCloseId) {
      const nextPath = removeTab(pendingTabCloseId);
      navigate(nextPath);
    }
    setShowTabCloseConfirm(false);
    setPendingTabCloseId(null);
    setPendingCloseAll(false);
  }, [pendingTabCloseId, pendingCloseAll, removeTab, closeAllTabs, navigate]);

  const handleTabCloseCancel = useCallback(() => {
    setShowTabCloseConfirm(false);
    setPendingTabCloseId(null);
    setPendingCloseAll(false);
  }, []);

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

  const sectionOrder = ['Main', 'Operations', 'Setup', 'System'];

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Skip to content link for accessibility */}
      <Box
        component="a"
        href="#main-content"
        sx={{
          position: 'absolute',
          top: -100,
          left: 0,
          zIndex: 9999,
          bgcolor: 'primary.main',
          color: 'white',
          p: 1,
          px: 2,
          textDecoration: 'none',
          fontWeight: 600,
          '&:focus': { top: 0 },
        }}
      >
        Skip to content
      </Box>
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />

      {/* Glassmorphism Top App Bar */}
      <AppBar
        position="fixed"
        elevation={0}
        role="banner"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          height: APP_BAR_HEIGHT,
          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.8)' : 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(8px) saturate(120%)',
          WebkitBackdropFilter: 'blur(8px) saturate(120%)',
          borderBottom: `1px solid ${isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(226, 232, 240, 0.8)'}`,
          color: isDark ? '#F1F5F9' : '#0F172A',
        }}
      >
        <Toolbar sx={{ px: { xs: 1.5, sm: 2.5 }, minHeight: `${APP_BAR_HEIGHT}px !important`, gap: 1 }}>
          {/* Hamburger */}
          <Tooltip title={drawerOpen ? 'Collapse sidebar' : 'Expand sidebar'} arrow>
            <IconButton
            edge="start"
            aria-label={drawerOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-expanded={drawerOpen}
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
                Mahaveer JI
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
                aria-label="Select company"
                value={company?.id || ''}
                onChange={(e) => {
                  const c = companyList?.find((c: any) => c.id === Number(e.target.value));
                  if (c && c.id !== company?.id) {
                    setPendingCompany(c);
                    setShowCompanyConfirm(true);
                  }
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
                aria-label="Select financial year"
                value={financialYear?.id || ''}
                onChange={(e) => {
                  const fy = fyList?.find((f: any) => f.id === Number(e.target.value));
                  if (fy && fy.id !== financialYear?.id) {
                    setPendingFy(fy);
                    setShowFyConfirm(true);
                  }
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
                {fyList?.map((fy: any) => (
                  <option key={fy.id} value={fy.id} disabled={fy.isClosed}>
                    {fy.label}{fy.isClosed ? ' (Closed)' : ''}
                  </option>
                ))}
              </Select>
            </FormControl>
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          {/* Global Search Trigger */}
          <Tooltip title="Search pages & actions (⌘K)" arrow>
            <Box
              role="button"
              aria-label="Open search. Keyboard shortcut Control K"
              tabIndex={0}
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
              <IconButton
                aria-label={`Notifications, ${notifUnreadCount} unread`}
                onClick={(e) => setNotifAnchorEl(notifAnchorEl ? null : e.currentTarget)}
                sx={{
                color: isDark ? '#94A3B8' : '#64748B',
                width: 36, height: 36, borderRadius: '10px',
                '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9' },
              }}>
                <Badge badgeContent={notifUnreadCount} color="error" sx={{ '& .MuiBadge-badge': { fontSize: '0.6rem', height: 16, minWidth: 16 } }}>
                  <Notifications sx={{ fontSize: 19 }} />
                </Badge>
              </IconButton>
            </Tooltip>

            <Tooltip title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'} arrow>
              <IconButton
                onClick={toggleDarkMode}
                aria-label={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
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
              aria-label="User menu"
              aria-haspopup="true"
              aria-expanded={Boolean(anchorEl)}
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
                aria-label="Sign out"
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

      {/* Sidebar - Always visible icon panel */}
      <Box
        onMouseEnter={() => {
          if (!drawerOpen) setSidebarHovered(true);
        }}
        onMouseLeave={() => {
          setSidebarHovered(false);
          setHoveredItem(null);
          setHoveredItemEl(null);
        }}
        role="navigation"
        aria-label="Main navigation"
        sx={{
          position: 'fixed',
          top: APP_BAR_HEIGHT,
          left: 0,
          height: `calc(100vh - ${APP_BAR_HEIGHT}px)`,
          width: effectiveExpanded ? DRAWER_WIDTH : COLLAPSED_DRAWER_WIDTH,
          zIndex: sidebarHovered && !drawerOpen ? 1200 : 1100,
          transition: 'width 250ms cubic-bezier(0.4, 0, 0.2, 1)',
          backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
          borderRight: `1px solid ${isDark ? '#1E293B' : '#F1F5F9'}`,
          display: 'flex',
          flexDirection: 'column',
          overflowX: 'hidden',
          boxShadow: sidebarHovered && !drawerOpen
            ? (isDark ? '4px 0 24px rgba(0,0,0,0.5)' : '4px 0 24px rgba(0,0,0,0.08)')
            : 'none',
        }}
      >
        <Box sx={{
          overflowY: 'auto',
          overflowX: 'hidden',
          pt: 1.5,
          pb: 2,
          px: effectiveExpanded ? 1 : 0.5,
          flex: 1,
          '&::-webkit-scrollbar': { width: 4 },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': { background: isDark ? '#334155' : '#E2E8F0', borderRadius: 4 },
          '&:hover::-webkit-scrollbar-thumb': { background: isDark ? '#475569' : '#CBD5E1' },
        }}>
          {sectionOrder.map((sectionName) => {
            const items = sections[sectionName];
            if (!items || items.length === 0) return null;
            const isSectionCollapsed = collapsedSections[sectionName] || false;
            const hasActiveChild = items.some((item) =>
              item.children?.some((c) => location.pathname.startsWith(c.path)) ||
              (item.path && location.pathname.startsWith(item.path))
            );
            return (
              <Box key={sectionName} sx={{ mb: 2 }}>
                <Box
                  onClick={() => effectiveExpanded && toggleSection(sectionName)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 0.75,
                    px: 1.25, mb: 0.75,
                    opacity: effectiveExpanded ? 1 : 0,
                    transition: 'opacity 200ms ease-out',
                    pointerEvents: effectiveExpanded ? 'auto' : 'none',
                    cursor: effectiveExpanded ? 'pointer' : 'default',
                    '&:hover': effectiveExpanded ? {
                      '& .section-label': { color: isDark ? '#94A3B8' : '#64748B' },
                    } : {},
                  }}
                >
                  <Box sx={{
                    width: 4, height: 4, borderRadius: '50%',
                    backgroundColor: hasActiveChild
                      ? (isDark ? '#60A5FA' : '#2563EB')
                      : (isDark ? '#475569' : '#CBD5E1'),
                    transition: 'background-color 200ms ease-out',
                  }} />
                  <Typography
                    className="section-label"
                    variant="caption"
                    sx={{
                      fontWeight: 700, fontSize: '0.5625rem',
                      letterSpacing: '0.1em', textTransform: 'uppercase',
                      color: hasActiveChild
                        ? (isDark ? '#94A3B8' : '#64748B')
                        : (isDark ? '#475569' : '#CBD5E1'),
                      transition: 'color 200ms ease-out',
                      flex: 1,
                    }}
                  >
                    {sectionName}
                  </Typography>
                  <Box sx={{
                    transform: isSectionCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                    transition: 'transform 200ms ease-out',
                    display: 'flex',
                    alignItems: 'center',
                  }}>
                    <ChevronRight sx={{ fontSize: 12, color: isDark ? '#475569' : '#CBD5E1', transform: 'rotate(90deg)' }} />
                  </Box>
                </Box>
                {!isSectionCollapsed && (
                <List component="nav" disablePadding aria-label={`${sectionName} navigation`}>
                  {items.map((item) => (
                    <React.Fragment key={item.text}>
                      {item.children ? (
                        <>
                          <Tooltip
                            title={!effectiveExpanded ? item.text : ''}
                            arrow
                            placement="right"
                            enterDelay={300}
                            leaveDelay={0}
                          >
                            <ListItemButton
                              onClick={() => effectiveExpanded && toggleMenu(item.text)}
                              onMouseEnter={(e) => {
                                if (effectiveExpanded) {
                                  if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
                                  setHoveredItem(item.text);
                                  setHoveredItemEl(e.currentTarget);
                                }
                              }}
                              onMouseLeave={() => {
                                if (effectiveExpanded) {
                                  hoverTimerRef.current = setTimeout(() => {
                                    setHoveredItem(null);
                                    setHoveredItemEl(null);
                                  }, 200);
                                }
                              }}
                              selected={isParentActive(item.children)}
                              aria-expanded={effectiveExpanded ? openMenus[item.text] : undefined}
                              aria-label={`${item.text} menu, ${isParentActive(item.children) ? 'expanded' : 'collapsed'}`}
                              sx={{
                                borderRadius: '10px',
                                mb: 0.125,
                                minHeight: 38,
                                px: effectiveExpanded ? 1 : 0,
                                justifyContent: effectiveExpanded ? 'initial' : 'center',
                                transition: 'all 120ms ease-out',
                                '&.Mui-selected': {
                                  backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
                                  '&:hover': { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.14)' : '#DBEAFE' },
                                },
                                '&:hover': {
                                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
                                },
                              }}
                            >
                              <ListItemIcon sx={{
                                minWidth: 0,
                                mr: effectiveExpanded ? 1.25 : 0,
                                justifyContent: 'center',
                                color: isParentActive(item.children)
                                  ? (isDark ? '#60A5FA' : '#2563EB')
                                  : (isDark ? '#64748B' : '#94A3B8'),
                                transition: 'color 120ms ease-out, margin 200ms ease-out',
                              }}>
                                {item.icon}
                              </ListItemIcon>
                              <Box sx={{
                                opacity: effectiveExpanded ? 1 : 0,
                                width: effectiveExpanded ? 'auto' : 0,
                                overflow: 'hidden',
                                whiteSpace: 'nowrap',
                                transition: 'opacity 200ms ease-out, width 200ms ease-out',
                                display: 'flex',
                                alignItems: 'center',
                              }}>
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
                                <ChevronRight sx={{ fontSize: 16, color: isDark ? '#475569' : '#CBD5E1', flexShrink: 0 }} />
                              </Box>
                            </ListItemButton>
                          </Tooltip>
                          {/* Popup submenu for expanded sidebar */}
                          {effectiveExpanded && (
                            <Popper
                              open={hoveredItem === item.text}
                              anchorEl={hoveredItemEl}
                              placement="right-start"
                              onMouseEnter={() => {
                                if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
                              }}
                              onMouseLeave={() => {
                                hoverTimerRef.current = setTimeout(() => {
                                  setHoveredItem(null);
                                  setHoveredItemEl(null);
                                }, 100);
                              }}
                              style={{ zIndex: 1300 }}
                            >
                              <Paper
                                elevation={8}
                                sx={{
                                  mt: -0.5,
                                  ml: 1,
                                  minWidth: 180,
                                  borderRadius: '10px',
                                  border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
                                  backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                                  py: 0.5,
                                }}
                              >
                                <List component="nav" disablePadding>
                                  {item.children.map((child) => (
                                    <ListItemButton
                                      key={child.path}
                                      aria-label={`Navigate to ${child.text}`}
                                      sx={{
                                        px: 1.5,
                                        py: 0.5,
                                        borderRadius: '8px',
                                        mx: 0.5,
                                        mb: 0.25,
                                        minHeight: 36,
                                        transition: 'all 120ms ease-out',
                                        '&.Mui-selected': {
                                          backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
                                        },
                                        '&:hover': {
                                          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
                                        },
                                      }}
                                      selected={isActive(child.path)}
                                      aria-current={isActive(child.path) ? 'page' : undefined}
                                      onClick={() => {
                                        openInTab(child.path);
                                        setHoveredItem(null);
                                        setHoveredItemEl(null);
                                      }}
                                    >
                                      {child.icon && (
                                        <ListItemIcon sx={{
                                          minWidth: 28,
                                          mr: 1,
                                          color: isActive(child.path)
                                            ? (isDark ? '#60A5FA' : '#2563EB')
                                            : (isDark ? '#64748B' : '#94A3B8'),
                                        }}>
                                          {child.icon}
                                        </ListItemIcon>
                                      )}
                                      <ListItemText
                                        primary={child.text}
                                        primaryTypographyProps={{
                                          fontSize: '0.8125rem',
                                          fontWeight: isActive(child.path) ? 600 : 400,
                                          color: isActive(child.path)
                                            ? (isDark ? '#F1F5F9' : '#0F172A')
                                            : (isDark ? '#CBD5E1' : '#475569'),
                                        }}
                                      />
                                    </ListItemButton>
                                  ))}
                                </List>
                              </Paper>
                            </Popper>
                          )}
                        </>
                      ) : (
                        <Tooltip
                          title={!effectiveExpanded ? item.text : ''}
                          arrow
                          placement="right"
                          enterDelay={300}
                          leaveDelay={0}
                        >
                            <ListItemButton
                              selected={item.path ? isActive(item.path) : false}
                              aria-label={`Navigate to ${item.text}`}
                              aria-current={item.path ? isActive(item.path) : undefined}
                              onClick={() => {
                                if (item.path) {
                                  openInTab(item.path);
                                }
                              }}
                              sx={{
                                borderRadius: '10px',
                                mb: 0.125,
                                minHeight: 38,
                                px: effectiveExpanded ? 1 : 0,
                                justifyContent: effectiveExpanded ? 'initial' : 'center',
                                transition: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
                                '&.Mui-selected': {
                                  backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
                                  '&:hover': { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.14)' : '#DBEAFE' },
                                },
                                '&:hover': {
                                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
                                },
                              }}
                            >
                            <ListItemIcon sx={{
                              minWidth: 0,
                              mr: effectiveExpanded ? 1.25 : 0,
                              justifyContent: 'center',
                              color: (item.path ? isActive(item.path) : false)
                                ? (isDark ? '#60A5FA' : '#2563EB')
                                : (isDark ? '#64748B' : '#94A3B8'),
                              transition: 'color 120ms ease-out, margin 200ms ease-out',
                            }}>
                              {item.icon}
                            </ListItemIcon>
                            <Box sx={{
                              opacity: effectiveExpanded ? 1 : 0,
                              width: effectiveExpanded ? 'auto' : 0,
                              overflow: 'hidden',
                              whiteSpace: 'nowrap',
                              transition: 'opacity 200ms ease-out, width 200ms ease-out',
                            }}>
                              <ListItemText
                                primary={item.text}
                                primaryTypographyProps={{
                                  fontSize: '0.8125rem',
                                  fontWeight: (item.path ? isActive(item.path) : false) ? 600 : 500,
                                  color: (item.path ? isActive(item.path) : false)
                                    ? (isDark ? '#F1F5F9' : '#0F172A')
                                    : (isDark ? '#CBD5E1' : '#475569'),
                                }}
                              />
                            </Box>
                          </ListItemButton>
                        </Tooltip>
                      )}
                    </React.Fragment>
                  ))}
                </List>
                )}
              </Box>
            );
          })}
        </Box>

        {/* Sidebar Footer - Version Info */}
        <Box sx={{
          p: 1.25,
          borderTop: `1px solid ${isDark ? '#1E293B' : '#F1F5F9'}`,
          opacity: effectiveExpanded ? 1 : 0,
          transition: 'opacity 200ms ease-out',
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
              v2.0.0 • Inventory Management System
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Main Content */}
      <Box
        component="main"
        id="main-content"
        aria-label="Main content"
        sx={{
          position: 'fixed',
          left: effectiveExpanded ? `${DRAWER_WIDTH}px` : `${COLLAPSED_DRAWER_WIDTH}px`,
          top: APP_BAR_HEIGHT,
          right: 0,
          bottom: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
          transition: 'left 250ms cubic-bezier(0.4, 0, 0.2, 1), background-color 0.3s ease',
        }}
      >
        <TabBar onRequestClose={(tabId) => {
          setPendingTabCloseId(tabId);
          setShowTabCloseConfirm(true);
        }} />
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

      {/* Notification Panel */}
      <NotificationPanel
        anchorEl={notifAnchorEl}
        open={notifOpen}
        onClose={() => setNotifAnchorEl(null)}
        onUnreadCountChange={setNotifUnreadCount}
      />

      {/* Company Change Confirmation Dialog */}
      <Dialog open={showCompanyConfirm} onClose={() => { setShowCompanyConfirm(false); setPendingCompany(null); }}>
        <DialogTitle>Change Company?</DialogTitle>
        <DialogContent>
          <Typography>
            Switch to <strong>{pendingCompany?.name}</strong>? This will reset the financial year selection.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setShowCompanyConfirm(false); setPendingCompany(null); }}>Cancel</Button>
          <Button variant="contained" onClick={confirmCompanyChange}>Yes, Switch</Button>
        </DialogActions>
      </Dialog>

      {/* Financial Year Change Confirmation Dialog */}
      <Dialog open={showFyConfirm} onClose={() => { setShowFyConfirm(false); setPendingFy(null); }}>
        <DialogTitle>Change Financial Year?</DialogTitle>
        <DialogContent>
          <Typography>
            Switch to <strong>{pendingFy?.label}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setShowFyConfirm(false); setPendingFy(null); }}>Cancel</Button>
          <Button variant="contained" onClick={confirmFyChange}>Yes, Switch</Button>
        </DialogActions>
      </Dialog>

      {/* Tab Close Confirmation Dialog */}
      <UnsavedChangesDialog
        open={showTabCloseConfirm}
        onConfirm={handleTabCloseConfirm}
        onCancel={handleTabCloseCancel}
        hasDraftSupport={false}
      />
    </Box>
  );
}
