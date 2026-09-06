import React, { useMemo, useCallback, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Stack, Chip, alpha, useTheme, IconButton, Tooltip,
  LinearProgress, Collapse,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Inventory as InventoryIcon, Receipt as ReceiptIcon, Assignment as AssignmentIcon,
  Warning as WarningIcon, TrendingUp, TrendingDown, Refresh, LocalShipping,
  Warehouse, Assessment, ArrowForward, Add, Transform, Delete,
  ExpandMore, ExpandLess,
} from '@mui/icons-material';
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  Legend, ComposedChart,
} from 'recharts';
import { useCompany } from '../../context/CompanyContext';
import { PageLoader } from '../../components/LoadingSkeleton';
import MetricCard from '../../components/MetricCard';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';
import { GuideButton } from '../../components/GuideSystem';

const COLORS = {
  primary: '#2563EB',
  success: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',
  info: '#0EA5E9',
  purple: '#7C3AED',
};

const CHART_COLORS = ['#2563EB', '#16A34A', '#D97706', '#DC2626', '#7C3AED', '#0EA5E9', '#EC4899', '#F59E0B', '#10B981', '#6366F1'];

const fetchDashboardData = async (companyId: number, financialYearId: number) => {
  const result = await window.electronAPI.getDashboardData(companyId, financialYearId);
  return result;
};

const QuickActions = React.memo(function QuickActions({ actions, isDark }: { actions: Array<{ label: string; desc: string; icon: React.ReactNode; color: string; path: string }>; isDark: boolean }) {
  const navigate = useNavigate();
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 1.25, mb: 2.5 }}>
      {actions.map((action, index) => (
        <Card
          key={action.label}
          onClick={() => navigate(action.path)}
          sx={{
            cursor: 'pointer',
            animation: `fadeInUp 400ms cubic-bezier(0.16, 1, 0.3, 1) ${index * 50}ms forwards`,
            opacity: 0,
            transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: `0 8px 24px -4px ${alpha(action.color, 0.15)}`,
              '& .quick-action-icon': {
                backgroundColor: alpha(action.color, isDark ? 0.2 : 0.12),
                transform: 'scale(1.05)',
              },
            },
          }}
        >
          <CardContent sx={{ p: '14px !important', display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              className="quick-action-icon"
              sx={{
                width: 40, height: 40, borderRadius: '11px',
                backgroundColor: alpha(action.color, isDark ? 0.12 : 0.08),
                color: action.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                transition: 'all 200ms ease-out',
              }}
            >
              {action.icon}
            </Box>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8125rem', color: 'text.primary', lineHeight: 1.3 }}>
                {action.label}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem' }}>
                {action.desc}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
});

export default function Dashboard() {
  const { company, financialYear } = useCompany();
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [showAllLowStock, setShowAllLowStock] = useState(false);

  const { data: stats, isLoading, refetch, isError } = useQuery({
    queryKey: ['dashboard', company?.id, financialYear?.id],
    queryFn: () => fetchDashboardData(company!.id, financialYear!.id),
    enabled: !!company?.id && !!financialYear?.id,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: true,
  });

  if (!company || !financialYear) {
    return (
      <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" minHeight="60vh" gap={2.5}>
        <Box sx={{
          width: 80, height: 80, borderRadius: '22px',
          background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 12px 32px rgba(37, 99, 235, 0.3)',
        }}>
          <InventoryIcon sx={{ fontSize: 40, color: '#FFFFFF' }} />
        </Box>
        <Box textAlign="center">
          <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.025em', mb: 0.5 }}>
            Welcome to Mahaveerji
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 380, lineHeight: 1.6 }}>
            Select a Company and Financial Year from the top navigation bar to get started.
          </Typography>
        </Box>
      </Box>
    );
  }

  if (isLoading) return <PageLoader message="Loading dashboard..." icon={<InventoryIcon />} />;

  if (isError) {
    return (
      <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" minHeight="60vh" gap={2}>
        <Typography variant="h6" color="error" fontWeight={600}>Failed to load dashboard</Typography>
        <Typography variant="body2" color="text.secondary">Please check your connection and try again.</Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Retry">
            <IconButton onClick={() => refetch()} aria-label="Retry" sx={{ border: '1px solid', borderColor: 'divider' }}>
              <Refresh />
            </IconButton>
          </Tooltip>
          <Tooltip title="Go to Dashboard">
            <IconButton onClick={() => navigate('/')} aria-label="Go to Dashboard" sx={{ border: '1px solid', borderColor: 'divider' }}>
              <ArrowForward sx={{ transform: 'rotate(180deg)' }} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>
    );
  }

  const quickActions = [
    { label: 'Goods Receipt', desc: 'Inward material', icon: <ReceiptIcon sx={{ fontSize: 20 }} />, color: COLORS.success, path: '/procurement/grn/new' },
    { label: 'Store Issue', desc: 'Outward material', icon: <LocalShipping sx={{ fontSize: 20 }} />, color: COLORS.primary, path: '/inventory/issue-challan/new' },
    { label: 'Store Transfer', desc: 'Move between stores', icon: <Transform sx={{ fontSize: 20 }} />, color: COLORS.purple, path: '/inventory/transfer-challan/new' },
    { label: 'Damage Entry', desc: 'Record damage', icon: <Delete sx={{ fontSize: 20 }} />, color: COLORS.danger, path: '/inventory/damage-entry' },
  ];

  const gridColor = isDark ? '#334155' : '#E2E8F0';
  const textColor = isDark ? '#94A3B8' : '#64748B';
  const tooltipStyle = {
    contentStyle: {
      backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
      border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
      borderRadius: 10,
      fontSize: '0.75rem',
      fontFamily: '"Inter", sans-serif',
      boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,0,0.08)',
    },
  };

  return (
    <Box aria-label="Dashboard overview">
      {/* Page Header */}
      <Box sx={{ mb: 2.5, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 1.5 }}>
        <Box>
          <Typography variant="h4" sx={{
            fontWeight: 800, color: 'text.primary', mb: 0.25,
            letterSpacing: '-0.025em', fontSize: '1.375rem',
          }}>
            Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
            {company.name}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <GuideButton pageId="dashboard" />
          <Tooltip title="Refresh data">
            <IconButton
              onClick={() => refetch()}
              size="small"
              aria-label="Refresh dashboard data"
              sx={{
                color: 'text.secondary',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: '10px',
                width: 36, height: 36,
                '&:hover': { backgroundColor: 'action.hover' },
              }}
            >
              <Refresh fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      <QuickActions actions={quickActions} isDark={isDark} />

      {/* KPI Metric Cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 1.25, mb: 2.5 }} role="region" aria-label="Key performance indicators">
        <MetricCard
          title="Total Items"
          value={stats?.totalItems || 0}
          icon={<InventoryIcon sx={{ fontSize: 20 }} />}
          color={COLORS.primary}
          onClick={() => navigate('/masters/items')}
          delay={200}
        />
        <MetricCard
          title="Stock Value"
          value={stats?.stockValue || 0}
          prefix="₹"
          icon={<Warehouse sx={{ fontSize: 20 }} />}
          color={COLORS.success}
          onClick={() => navigate('/inventory/stock-ledger')}
          delay={260}
          format="currency"
        />
        <MetricCard
          title="Available Qty"
          value={stats?.availableQty || 0}
          icon={<Assessment sx={{ fontSize: 20 }} />}
          color={COLORS.info}
          onClick={() => navigate('/inventory/stock-ledger')}
          delay={320}
        />
        <MetricCard
          title="Low Stock"
          value={stats?.lowStockItems || 0}
          icon={<WarningIcon sx={{ fontSize: 20 }} />}
          color={COLORS.warning}
          trend={stats?.lowStockItems ? `${stats.lowStockItems} items` : '0'}
          trendUp={false}
          onClick={() => navigate('/reports')}
          delay={380}
        />
      </Box>

      {/* Pending Drafts Alert */}
      {stats?.pendingDrafts ? stats.pendingDrafts > 0 && (
        <Card
          role="alert"
          aria-label={`${stats.pendingDrafts} pending drafts await review`}
          sx={{
            mb: 2,
            borderLeft: `3px solid ${COLORS.primary}`,
            animation: 'fadeInUp 400ms cubic-bezier(0.16, 1, 0.3, 1) 440ms forwards',
            opacity: 0,
          }}
        >
          <CardContent sx={{ p: '12px 16px !important' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Stack direction="row" alignItems="center" spacing={1}>
                <Box sx={{
                  width: 28, height: 28, borderRadius: '8px',
                  backgroundColor: alpha(COLORS.primary, 0.1),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <AssignmentIcon sx={{ fontSize: 14, color: COLORS.primary }} />
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8125rem' }}>
                  {stats.pendingDrafts} pending draft{stats.pendingDrafts > 1 ? 's' : ''} awaiting your review
                </Typography>
              </Stack>
              <Typography
                variant="caption"
                onClick={() => navigate('/procurement/grn')}
                role="button"
                tabIndex={0}
                aria-label="Review pending drafts now"
                sx={{
                  color: COLORS.primary, cursor: 'pointer', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 0.5,
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                Review Now <ArrowForward sx={{ fontSize: 12 }} />
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {/* Today's Activity */}
      {stats?.recentTransactions && stats.recentTransactions.length > 0 && (
        <Card sx={{
          mb: 2,
          animation: 'fadeInUp 400ms cubic-bezier(0.16, 1, 0.3, 1) 460ms forwards',
          opacity: 0,
        }}>
          <CardContent sx={{ p: '14px 16px !important' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.25}>
              <Stack direction="row" alignItems="center" spacing={0.75}>
                <AssignmentIcon sx={{ fontSize: 16, color: COLORS.info }} />
                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '0.8125rem', color: COLORS.info }}>
                  Recent Activity
                </Typography>
              </Stack>
              <Typography
                variant="caption"
                onClick={() => navigate('/inventory/stock-ledger')}
                role="button"
                tabIndex={0}
                aria-label="View all activity"
                sx={{
                  color: COLORS.primary, cursor: 'pointer', fontWeight: 600,
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                View All
              </Typography>
            </Stack>
            <Stack spacing={0.75}>
              {stats.recentTransactions.slice(0, 5).map((tx: any, idx: number) => (
                <Stack
                  key={idx}
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{
                    py: 0.75, px: 1, borderRadius: '8px',
                    '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC' },
                    cursor: 'pointer',
                  }}
                  onClick={() => navigate(`/inventory/item-history?itemId=${tx.itemId}`)}
                >
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Box sx={{
                      width: 6, height: 6, borderRadius: '50%',
                      backgroundColor: tx.quantityIn ? COLORS.success : COLORS.warning,
                    }} />
                    <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.8125rem' }}>
                      {typeof tx.item === 'string' ? tx.item : tx.item?.itemName || 'Unknown Item'}
                    </Typography>
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem' }}>
                      {tx.transactionType}
                    </Typography>
                    <Chip
                      label={tx.quantityIn ? `+${tx.quantityIn}` : `-${tx.quantityOut}`}
                      size="small"
                      sx={{
                        height: 18, fontSize: '0.625rem', fontWeight: 600,
                        backgroundColor: tx.quantityIn ? alpha(COLORS.success, 0.1) : alpha(COLORS.warning, 0.1),
                        color: tx.quantityIn ? COLORS.success : COLORS.warning,
                      }}
                    />
                  </Stack>
                </Stack>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Low Stock Alerts */}
      {stats?.lowStockItemsDetail && stats.lowStockItemsDetail.length > 0 && (() => {
        const sorted = [...stats.lowStockItemsDetail].sort((a: any, b: any) => {
          const pctA = a.minimumStockLevel > 0 ? a.currentBalance / a.minimumStockLevel : 0;
          const pctB = b.minimumStockLevel > 0 ? b.currentBalance / b.minimumStockLevel : 0;
          return pctA - pctB;
        });
        const VISIBLE_COUNT = 6;
        const visibleItems = showAllLowStock ? sorted : sorted.slice(0, VISIBLE_COUNT);
        const hasMore = sorted.length > VISIBLE_COUNT;
        const criticalCount = sorted.filter((i: any) => i.minimumStockLevel > 0 && (i.currentBalance / i.minimumStockLevel) < 0.5).length;
        return (
          <Card sx={{
            mb: 2,
            borderLeft: `3px solid ${COLORS.warning}`,
            animation: 'fadeInUp 400ms cubic-bezier(0.16, 1, 0.3, 1) 480ms forwards',
            opacity: 0,
          }}
            role="region"
            aria-label="Low stock alerts"
          >
            <CardContent sx={{ p: '14px 16px !important' }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.25}>
                <Stack direction="row" alignItems="center" spacing={0.75}>
                  <WarningIcon sx={{ fontSize: 16, color: COLORS.warning }} />
                  <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '0.8125rem', color: COLORS.warning }}>
                    Low Stock Alerts
                  </Typography>
                  <Chip
                    label={stats.lowStockItemsDetail.length}
                    size="small"
                    sx={{
                      height: 18, fontSize: '0.5625rem', fontWeight: 700,
                      backgroundColor: alpha(COLORS.warning, 0.1),
                      color: COLORS.warning,
                    }}
                  />
                  {criticalCount > 0 && (
                    <Chip
                      label={`${criticalCount} critical`}
                      size="small"
                      sx={{
                        height: 18, fontSize: '0.5625rem', fontWeight: 700,
                        backgroundColor: alpha(COLORS.danger, 0.1),
                        color: COLORS.danger,
                      }}
                    />
                  )}
                </Stack>
                <Stack direction="row" alignItems="center" spacing={1}>
                  {hasMore && (
                    <Typography
                      variant="caption"
                      onClick={() => setShowAllLowStock(!showAllLowStock)}
                      role="button"
                      tabIndex={0}
                      sx={{
                        color: COLORS.primary, cursor: 'pointer', fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: 0.5,
                        '&:hover': { textDecoration: 'underline' },
                      }}
                    >
                      {showAllLowStock ? 'Show less' : `Show all (${sorted.length})`}
                      {showAllLowStock ? <ExpandLess sx={{ fontSize: 14 }} /> : <ExpandMore sx={{ fontSize: 14 }} />}
                    </Typography>
                  )}
                  <Typography
                    variant="caption"
                    onClick={() => navigate('/reports')}
                    role="button"
                    tabIndex={0}
                    aria-label="View all low stock items"
                    sx={{
                      color: COLORS.primary, cursor: 'pointer', fontWeight: 600,
                      '&:hover': { textDecoration: 'underline' },
                    }}
                  >
                    View All
                  </Typography>
                </Stack>
              </Stack>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(3, 1fr)' }, gap: 1 }}>
                {visibleItems.map((item: any) => {
                  const pct = item.minimumStockLevel > 0 ? Math.min(100, (item.currentBalance / item.minimumStockLevel) * 100) : 0;
                  const isCritical = pct < 50;
                  return (
                    <Box
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`${item.itemName}: current ${item.currentBalance}, minimum ${item.minimumStockLevel}`}
                      onClick={() => navigate(`/inventory/item-history?itemId=${item.id}`)}
                      sx={{
                        p: 1.25, borderRadius: '10px', cursor: 'pointer',
                        border: `1px solid ${isCritical ? alpha(COLORS.danger, 0.3) : isDark ? '#334155' : '#E2E8F0'}`,
                        backgroundColor: isCritical ? alpha(COLORS.danger, 0.02) : 'transparent',
                        transition: 'all 150ms ease-out',
                        '&:hover': {
                          borderColor: isCritical ? COLORS.danger : COLORS.warning,
                          backgroundColor: alpha(isCritical ? COLORS.danger : COLORS.warning, 0.03),
                          transform: 'translateY(-1px)',
                        },
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
                        <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.75rem', lineHeight: 1.3 }}>
                          {item.itemName}
                        </Typography>
                        <Chip label={item.unit?.name || '-'} size="small" sx={{ height: 16, fontSize: '0.5625rem' }} />
                      </Stack>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontSize: '0.625rem' }}>
                        Min: {item.minimumStockLevel} &bull; Current: {item.currentBalance}
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={pct}
                        sx={{
                          height: 3, borderRadius: 2,
                          backgroundColor: alpha(isCritical ? COLORS.danger : COLORS.warning, 0.12),
                          '& .MuiLinearProgress-bar': { borderRadius: 2, backgroundColor: isCritical ? COLORS.danger : COLORS.warning },
                        }}
                      />
                    </Box>
                  );
                })}
              </Box>
            </CardContent>
          </Card>
        );
      })()}

      {/* Charts Section */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5, mb: 2 }} role="region" aria-label="Stock analytics charts">
        {/* Stock Value Trend */}
        <Card sx={{ animation: 'fadeInUp 400ms ease-out 520ms forwards', opacity: 0 }} aria-label="Stock value trend chart">
          <CardContent sx={{ p: '14px 16px !important' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.25, fontSize: '0.8125rem' }}>Stock Value Trend</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block', fontSize: '0.6875rem' }}>Last 12 months</Typography>
            <Box sx={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats?.stockTrend || []} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradientValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.12} />
                      <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: textColor, fontFamily: 'Inter' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: textColor, fontFamily: 'Inter' }} axisLine={false} tickLine={false} />
                  <RechartsTooltip {...tooltipStyle} />
                  <Area type="monotone" dataKey="value" stroke={COLORS.primary} strokeWidth={2} fill="url(#gradientValue)" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#FFFFFF' }} />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>

        {/* Inventory Movement */}
        <Card sx={{ animation: 'fadeInUp 400ms ease-out 560ms forwards', opacity: 0 }} aria-label="Inventory movement chart">
          <CardContent sx={{ p: '14px 16px !important' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.25, fontSize: '0.8125rem' }}>Inventory Movement</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block', fontSize: '0.6875rem' }}>Inbound vs Outbound</Typography>
            <Box sx={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats?.monthlyMovement || []} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: textColor, fontFamily: 'Inter' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: textColor, fontFamily: 'Inter' }} axisLine={false} tickLine={false} />
                  <RechartsTooltip {...tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: '0.625rem', paddingTop: 8, fontFamily: 'Inter' }} />
                  <Line type="monotone" dataKey="inbound" name="Inbound" stroke={COLORS.primary} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="outbound" name="Outbound" stroke={COLORS.warning} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Charts Row 2 */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5, mb: 2 }} role="region" aria-label="Consumption and category charts">
        {/* Top Consumed Items */}
        <Card sx={{ animation: 'fadeInUp 400ms ease-out 600ms forwards', opacity: 0 }} aria-label="Top consumed items chart">
          <CardContent sx={{ p: '14px 16px !important' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.25, fontSize: '0.8125rem' }}>Top Consumed Items</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block', fontSize: '0.6875rem' }}>By quantity consumed</Typography>
            <Box sx={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.topConsumed || []} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: textColor, fontFamily: 'Inter' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: textColor, fontFamily: 'Inter' }} axisLine={false} tickLine={false} width={80} />
                  <RechartsTooltip {...tooltipStyle} />
                  <Bar dataKey="consumed" fill={COLORS.primary} radius={[0, 4, 4, 0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>

        {/* Category Distribution */}
        <Card sx={{ animation: 'fadeInUp 400ms ease-out 640ms forwards', opacity: 0 }} aria-label="Category distribution chart">
          <CardContent sx={{ p: '14px 16px !important' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.25, fontSize: '0.8125rem' }}>Category Distribution</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block', fontSize: '0.6875rem' }}>Stock by category</Typography>
            <Box sx={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats?.categoryData || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={78}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {(stats?.categoryData || []).map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} stroke="none" />
                    ))}
                  </Pie>
                  <RechartsTooltip {...tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: '0.625rem', fontFamily: 'Inter' }} />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Charts Row 3 */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5, mb: 2 }} role="region" aria-label="Department and receipt charts">
        {/* Department Consumption */}
        <Card sx={{ animation: 'fadeInUp 400ms ease-out 680ms forwards', opacity: 0 }} aria-label="Department consumption chart">
          <CardContent sx={{ p: '14px 16px !important' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.25, fontSize: '0.8125rem' }}>Department Consumption</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block', fontSize: '0.6875rem' }}>By department</Typography>
            <Box sx={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.deptWise || []} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: textColor, fontFamily: 'Inter' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: textColor, fontFamily: 'Inter' }} axisLine={false} tickLine={false} />
                  <RechartsTooltip {...tooltipStyle} />
                  <Bar dataKey="consumed" fill={COLORS.info} radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>

        {/* Receipt vs Issue */}
        <Card sx={{ animation: 'fadeInUp 400ms ease-out 720ms forwards', opacity: 0 }} aria-label="Receipt versus issue comparison chart">
          <CardContent sx={{ p: '14px 16px !important' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.25, fontSize: '0.8125rem' }}>Receipt vs Issue</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block', fontSize: '0.6875rem' }}>Monthly comparison</Typography>
            <Box sx={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={stats?.receiptVsIssue || []} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: textColor, fontFamily: 'Inter' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: textColor, fontFamily: 'Inter' }} axisLine={false} tickLine={false} />
                  <RechartsTooltip {...tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: '0.625rem', paddingTop: 8, fontFamily: 'Inter' }} />
                  <Bar dataKey="receipts" name="Receipts" fill={COLORS.success} radius={[4, 4, 0, 0]} barSize={14} />
                  <Bar dataKey="issues" name="Issues" fill={COLORS.danger} radius={[4, 4, 0, 0]} barSize={14} />
                </ComposedChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Recent Transactions */}
      <Card sx={{ animation: 'fadeInUp 400ms ease-out 760ms forwards', opacity: 0 }} aria-label="Recent transactions">
        <CardContent sx={{ p: '14px 16px !important' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.25}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.25, fontSize: '0.8125rem' }}>Recent Transactions</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem' }}>Latest stock activities</Typography>
            </Box>
            <Typography
              variant="caption"
              onClick={() => navigate('/inventory/stock-ledger')}
              role="button"
              tabIndex={0}
              aria-label="View all transactions"
              sx={{
                color: COLORS.primary, cursor: 'pointer', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 0.25,
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              View All <ArrowForward sx={{ fontSize: 11 }} />
            </Typography>
          </Stack>
          <Box sx={{ maxHeight: 260, overflow: 'auto' }}>
            {stats?.recentTransactions?.slice(0, 10).map((tx: any, idx: number) => (
              <Box
                key={idx}
                onClick={() => navigate(`/inventory/item-history?itemId=${tx.itemId}`)}
                role="button"
                tabIndex={0}
                aria-label={`${typeof tx.item === 'string' ? tx.item : tx.item?.itemName || 'Item'}: ${tx.quantityIn ? 'received' : 'issued'} ${tx.quantityIn || tx.quantityOut} units`}
                sx={{
                  py: 0.875, px: 0.5, borderRadius: '8px', cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  borderBottom: `1px solid ${isDark ? '#1E293B' : '#F1F5F9'}`,
                  '&:last-child': { borderBottom: 0 },
                  '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC' },
                  transition: 'background-color 100ms ease-out',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{
                    width: 30, height: 30, borderRadius: '8px',
                    backgroundColor: tx.quantityOut > 0 ? alpha(COLORS.danger, isDark ? 0.12 : 0.08) : alpha(COLORS.success, isDark ? 0.12 : 0.08),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {tx.quantityOut > 0 ? (
                      <TrendingDown sx={{ fontSize: 13, color: COLORS.danger }} />
                    ) : (
                      <TrendingUp sx={{ fontSize: 13, color: COLORS.success }} />
                    )}
                  </Box>
                  <Box>
                    <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.75rem', lineHeight: 1.3 }}>
                      {tx.item?.itemName || `Item #${tx.itemId}`}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.625rem' }}>
                      {tx.transactionType} &bull; {tx.department?.name || 'Store'} &bull; {formatDateDDMMYYYY(tx.transactionDate)}
                    </Typography>
                  </Box>
                </Box>
                <Typography variant="body2" fontWeight={700} sx={{
                  fontFamily: '"JetBrains Mono", monospace', fontSize: '0.6875rem',
                  color: tx.quantityOut > 0 ? COLORS.danger : COLORS.success,
                }}>
                  {tx.quantityOut > 0 ? `-${tx.quantityOut}` : `+${tx.quantityIn}`}
                </Typography>
              </Box>
            ))}
            {(!stats?.recentTransactions || stats.recentTransactions.length === 0) && (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">No recent transactions</Typography>
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
