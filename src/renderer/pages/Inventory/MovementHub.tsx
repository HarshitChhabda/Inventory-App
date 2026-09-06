import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Stack, alpha, useTheme, InputAdornment,
  TextField, Chip,
} from '@mui/material';
import {
  Assignment as DemandIcon,
  LocalShipping as ReceiveIcon,
  Output as IssueIcon,
  SwapHoriz as TransferIcon,
  Receipt as ConsumptionIcon,
  Build as InstallIcon,
  Warning as DamageIcon,
  Undo as ReturnIcon,
  Tune as AdjustIcon,
  History as HistoryIcon,
  MenuBook as LedgerIcon,
  List as ListIcon,
  Search as SearchIcon,
  AccessTime as RecentIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';

interface MovementAction {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  path: string;
  color: string;
  keywords: string;
}

const allActions: MovementAction[] = [
  {
    title: 'New Direct Demand',
    subtitle: 'Enter a physical demand slip into the system',
    icon: <DemandIcon sx={{ fontSize: 20 }} />,
    path: '/inventory/new-demand',
    color: '#EA580C',
    keywords: 'demand slip new create enter physical',
  },
  {
    title: 'Receive Material',
    subtitle: 'Goods receipt from vendor or purchase order',
    icon: <ReceiveIcon sx={{ fontSize: 20 }} />,
    path: '/procurement/grn/new',
    color: '#16A34A',
    keywords: 'receive grn receipt goods vendor purchase inward',
  },
  {
    title: 'Issue Material',
    subtitle: 'Issue from store to department or against demand',
    icon: <IssueIcon sx={{ fontSize: 20 }} />,
    path: '/inventory/material-issue',
    color: '#2563EB',
    keywords: 'issue material outward department store',
  },
  {
    title: 'Transfer Material',
    subtitle: 'Move stock between stores',
    icon: <TransferIcon sx={{ fontSize: 20 }} />,
    path: '/inventory/material-transfer',
    color: '#7C3AED',
    keywords: 'transfer move stock between stores',
  },
  {
    title: 'Consume Material',
    subtitle: 'Record material used at a location',
    icon: <ConsumptionIcon sx={{ fontSize: 20 }} />,
    path: '/inventory/consumption/new',
    color: '#F97316',
    keywords: 'consume usage used location',
  },
  {
    title: 'Install Material',
    subtitle: 'Record material placed at a location',
    icon: <InstallIcon sx={{ fontSize: 20 }} />,
    path: '/inventory/installation/new',
    color: '#10B981',
    keywords: 'install placed asset location',
  },
  {
    title: 'Damage Entry',
    subtitle: 'Record damaged material',
    icon: <DamageIcon sx={{ fontSize: 20 }} />,
    path: '/inventory/damage-entry',
    color: '#EF4444',
    keywords: 'damage broken defective',
  },
  {
    title: 'Vendor Return',
    subtitle: 'Return material to vendor',
    icon: <ReturnIcon sx={{ fontSize: 20 }} />,
    path: '/inventory/vendor-return',
    color: '#F59E0B',
    keywords: 'vendor return send back',
  },
  {
    title: 'Stock Adjustment',
    subtitle: 'Correct stock quantities',
    icon: <AdjustIcon sx={{ fontSize: 20 }} />,
    path: '/inventory/stock-adjustment',
    color: '#8B5CF6',
    keywords: 'adjust correct quantity mismatch',
  },
  {
    title: 'Demand Slips',
    subtitle: 'View all entered demand slips',
    icon: <ListIcon sx={{ fontSize: 20 }} />,
    path: '/inventory/demand-slips',
    color: '#EA580C',
    keywords: 'demand slips list view all',
  },
  {
    title: 'Consumption List',
    subtitle: 'View all consumption records',
    icon: <ListIcon sx={{ fontSize: 20 }} />,
    path: '/inventory/consumption',
    color: '#F59E0B',
    keywords: 'consumption list records view',
  },
  {
    title: 'Installation List',
    subtitle: 'View all installation records',
    icon: <ListIcon sx={{ fontSize: 20 }} />,
    path: '/inventory/installation',
    color: '#10B981',
    keywords: 'installation list records view',
  },
  {
    title: 'All Receipts',
    subtitle: 'View goods receipt history',
    icon: <ListIcon sx={{ fontSize: 20 }} />,
    path: '/procurement/grn',
    color: '#16A34A',
    keywords: 'receipts grn history view all',
  },
  {
    title: 'Stock Ledger',
    subtitle: 'View stock balance history',
    icon: <LedgerIcon sx={{ fontSize: 20 }} />,
    path: '/inventory/stock-ledger',
    color: '#6366F1',
    keywords: 'stock ledger balance history view',
  },
  {
    title: 'Item History',
    subtitle: 'Track item movement history',
    icon: <HistoryIcon sx={{ fontSize: 20 }} />,
    path: '/inventory/item-history',
    color: '#0EA5E9',
    keywords: 'item history track movement',
  },
];

const QUICK_ACTION_PATHS = [
  '/inventory/new-demand',
  '/procurement/grn/new',
  '/inventory/material-issue',
  '/inventory/material-transfer',
];

const RECENT_KEY = 'movementHub:recentPaths';

function getRecentPaths(): string[] {
  try {
    const raw = sessionStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecentPath(path: string) {
  try {
    const recent = getRecentPaths().filter((p) => p !== path);
    recent.unshift(path);
    sessionStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 6)));
  } catch {}
}

function ActionCard({ action, isRecent }: { action: MovementAction; isRecent?: boolean }) {
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const handleNav = useCallback(() => {
    saveRecentPath(action.path);
    navigate(action.path);
  }, [action.path, navigate]);

  return (
    <Card
      onClick={handleNav}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleNav();
        }
      }}
      sx={{
        cursor: 'pointer',
        border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
        borderRadius: '12px',
        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.6)' : '#FFFFFF',
        transition: 'all 150ms ease-out',
        position: 'relative',
        overflow: 'visible',
        '&::after': {
          content: '""',
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: 3,
          borderRadius: '12px 12px 0 0',
          background: action.color,
          opacity: 0,
          transition: 'opacity 150ms ease-out',
        },
        '&:hover': {
          borderColor: action.color,
          boxShadow: `0 4px 16px ${alpha(action.color, 0.12)}`,
          transform: 'translateY(-1px)',
          '&::after': { opacity: 1 },
        },
        '&:focus-visible': {
          outline: `2px solid ${action.color}`,
          outlineOffset: 2,
        },
      }}
    >
      <CardContent sx={{ p: '16px !important', '&:last-child': { pb: '16px !important' } }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: alpha(action.color, isDark ? 0.15 : 0.08),
              color: action.color,
              flexShrink: 0,
            }}
          >
            {action.icon}
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 700,
                  fontSize: '0.8125rem',
                  color: 'text.primary',
                  lineHeight: 1.3,
                }}
              >
                {action.title}
              </Typography>
              {isRecent && (
                <RecentIcon sx={{ fontSize: 12, color: 'text.secondary', flexShrink: 0 }} />
              )}
            </Stack>
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                fontSize: '0.6875rem',
                lineHeight: 1.4,
                display: 'block',
                mt: 0.15,
              }}
            >
              {action.subtitle}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function MovementHub() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [search, setSearch] = useState('');
  const [recentPaths, setRecentPaths] = useState<string[]>(getRecentPaths);

  useEffect(() => {
    setRecentPaths(getRecentPaths());
  }, []);

  const recentActions = useMemo(() => {
    if (recentPaths.length === 0) return [];
    return recentPaths
      .map((p) => allActions.find((a) => a.path === p))
      .filter(Boolean) as MovementAction[];
  }, [recentPaths]);

  const filteredActions = useMemo(() => {
    if (!search.trim()) return allActions;
    const q = search.toLowerCase();
    return allActions.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.subtitle.toLowerCase().includes(q) ||
        a.keywords.toLowerCase().includes(q)
    );
  }, [search]);

  const quickActions = filteredActions.filter((a) => QUICK_ACTION_PATHS.includes(a.path));
  const otherOps = filteredActions.filter(
    (a) => !QUICK_ACTION_PATHS.includes(a.path) && !a.path.includes('/demand-slips') && !a.path.includes('/consumption') && !a.path.includes('/installation') && !a.path.includes('/grn') && !a.path.includes('/stock-ledger') && !a.path.includes('/item-history')
  );
  const reports = filteredActions.filter(
    (a) => a.path.includes('/demand-slips') || a.path.includes('/consumption') || a.path.includes('/installation') || a.path.includes('/grn') || a.path.includes('/stock-ledger') || a.path.includes('/item-history')
  );

  const isSearching = search.trim().length > 0;

  return (
    <Box>
      <PageHeader
        title="Material Operations"
        subtitle="What would you like to do?"
        breadcrumbs={[
          { label: 'Dashboard', path: '/' },
          { label: 'Material Operations' },
        ]}
      />

      <Box sx={{ maxWidth: 900, mx: 'auto', mt: 1 }}>
        {/* Search */}
        <TextField
          fullWidth
          size="small"
          placeholder="Search operations... (e.g. demand, receipt, issue)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
              </InputAdornment>
            ),
          }}
          sx={{
            mb: 2.5,
            '& .MuiOutlinedInput-root': {
              borderRadius: '12px',
              backgroundColor: isDark ? 'rgba(15, 23, 42, 0.4)' : '#F8FAFC',
              fontSize: '0.8125rem',
            },
          }}
        />

        {/* Recent Actions */}
        {!isSearching && recentActions.length > 0 && (
          <Box sx={{ mb: 2.5 }}>
            <Stack direction="row" alignItems="center" spacing={0.5} mb={1}>
              <RecentIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'text.secondary',
                  fontSize: '0.6875rem',
                }}
              >
                Recent
              </Typography>
            </Stack>
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {recentActions.slice(0, 4).map((action) => (
                <Box key={action.title} sx={{ flex: '1 1 calc(25% - 8px)', minWidth: 200 }}>
                  <ActionCard action={action} isRecent />
                </Box>
              ))}
            </Stack>
          </Box>
        )}

        {/* Quick Actions */}
        {quickActions.length > 0 && (
          <Box sx={{ mb: 2.5 }}>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'text.secondary',
                fontSize: '0.6875rem',
                mb: 1,
                display: 'block',
              }}
            >
              {isSearching ? `Results (${filteredActions.length})` : 'Quick Actions'}
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {quickActions.map((action) => (
                <Box key={action.title} sx={{ flex: '1 1 calc(50% - 4px)', minWidth: 260 }}>
                  <ActionCard action={action} />
                </Box>
              ))}
            </Stack>
          </Box>
        )}

        {/* Other Operations */}
        {otherOps.length > 0 && (
          <Box sx={{ mb: 2.5 }}>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'text.secondary',
                fontSize: '0.6875rem',
                mb: 1,
                display: 'block',
              }}
            >
              Other Operations
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {otherOps.map((action) => (
                <Box key={action.title} sx={{ flex: '1 1 calc(33.33% - 7px)', minWidth: 220 }}>
                  <ActionCard action={action} />
                </Box>
              ))}
            </Stack>
          </Box>
        )}

        {/* Lists & Reports */}
        {reports.length > 0 && (
          <Box sx={{ mb: 2.5 }}>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'text.secondary',
                fontSize: '0.6875rem',
                mb: 1,
                display: 'block',
              }}
            >
              Lists & Reports
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {reports.map((action) => (
                <Box key={action.title} sx={{ flex: '1 1 calc(33.33% - 7px)', minWidth: 200 }}>
                  <ActionCard action={action} />
                </Box>
              ))}
            </Stack>
          </Box>
        )}

        {/* Empty state */}
        {isSearching && filteredActions.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <SearchIcon sx={{ fontSize: 40, color: 'text.secondary', opacity: 0.4, mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              No operations match "{search}"
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
