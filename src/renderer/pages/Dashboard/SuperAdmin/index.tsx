import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, LinearProgress, Alert, Tabs, Tab, Tooltip
} from '@mui/material';
import {
  Inventory, Business, Store, Apartment, Home, Room, People, SwapHoriz,
  Warning, TrendingUp, TrendingDown, Build, ShoppingCart, Assessment,
  CheckCircle, Error, Schedule, Search
} from '@mui/icons-material';
import { formatDateDDMMYYYY } from '../../../utils/dateUtils';

declare global { interface Window { electronAPI: any } }

export default function SuperAdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [dash, setDash] = useState<any>({});
  const [kpis, setKpis] = useState<any>({});
  const [trend, setTrend] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [topProblematic, setTopProblematic] = useState<any[]>([]);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const companyId = 1;
      const fy = await window.electronAPI.getCurrentFinancialYear(companyId);
      const filter = { companyId, financialYearId: fy?.id };
      const [d, k, t, ls, tp] = await Promise.all([
        window.electronAPI.getSuperAdminDashboard(filter),
        window.electronAPI.getKPIs(filter),
        window.electronAPI.getMonthlyTrend(companyId, 6),
        window.electronAPI.getLowStockItems(companyId),
        window.electronAPI.getTopProblematicAssets(companyId, 5),
      ]);
      setDash(d); setKpis(k); setTrend(t); setLowStock(ls); setTopProblematic(tp);
      setLoading(false);
    };
    load();
  }, []);

  const inventoryCards = [
    { label: 'Total Items', value: dash.totalItems || 0, icon: <Inventory />, color: 'primary.main' },
    { label: 'Total Assets', value: dash.totalAssets || 0, icon: <Business />, color: 'secondary.main' },
    { label: 'Total Stores', value: dash.totalStores || 0, icon: <Store />, color: 'info.main' },
    { label: 'Departments', value: dash.totalDepartments || 0, icon: <Apartment />, color: 'warning.main' },
    { label: 'Dharmshalas', value: dash.totalDharmshalas || 0, icon: <Home />, color: 'success.main' },
    { label: 'Rooms', value: dash.totalRooms || 0, icon: <Room />, color: 'error.main' },
    { label: 'Vendors', value: dash.totalVendors || 0, icon: <People />, color: 'info.dark' },
    { label: 'Users', value: dash.totalUsers || 0, icon: <People />, color: 'text.primary' },
  ];

  const stockCards = [
    { label: 'Inventory Value', value: `${(dash.inventoryValue || 0).toLocaleString()}`, color: 'primary.main' },
    { label: 'Installed Assets', value: dash.installedAssets || 0, color: 'success.main' },
    { label: 'Repair Stock', value: dash.repairStock || 0, color: 'warning.main' },
    { label: 'Damaged Stock', value: dash.damagedStock || 0, color: 'error.main' },
    { label: 'Scrap Stock', value: dash.scrapStock || 0, color: 'text.secondary' },
  ];

  const pendingCards = [
    { label: 'Pending Requests', value: dash.pendingRequests || 0, color: 'info.main' },
    { label: 'Pending Approvals', value: dash.pendingApprovals || 0, color: 'warning.main' },
    { label: 'Pending PO', value: dash.pendingPO || 0, color: 'secondary.main' },
    { label: 'Pending WO', value: dash.pendingWO || 0, color: 'error.main' },
    { label: 'Low Stock', value: dash.lowStockItems || 0, color: 'warning.dark' },
    { label: 'Out of Stock', value: dash.outOfStockItems || 0, color: 'error.dark' },
  ];

  const kpiCards = [
    { label: 'Stock Availability', value: `${kpis.stockAvailability || 100}%`, color: 'success.main' },
    { label: 'Asset Utilization', value: `${kpis.assetUtilization || 100}%`, color: 'info.main' },
    { label: 'Repair %', value: `${kpis.repairPercent || 0}%`, color: 'warning.main' },
    { label: 'Damage %', value: `${kpis.damagePercent || 0}%`, color: 'error.main' },
    { label: 'Maint. Cost', value: `₹${(kpis.totalMaintenanceCost || 0).toLocaleString()}`, color: 'secondary.main' },
  ];

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>Executive Dashboard</Typography>

      {loading ? <LinearProgress /> : (
        <>
          {/* Inventory Overview */}
          <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>Inventory Overview</Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {inventoryCards.map(c => (
              <Grid item xs={1.5} key={c.label}>
                <Card><CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                  <Box color={c.color} mb={0.5}>{c.icon}</Box>
                  <Typography variant="h6">{c.value}</Typography>
                  <Typography variant="caption" color="text.secondary">{c.label}</Typography>
                </CardContent></Card>
              </Grid>
            ))}
          </Grid>

          {/* Stock Status */}
          <Typography variant="h6" gutterBottom>Stock Status</Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {stockCards.map(c => (
              <Grid item xs={2.4} key={c.label}>
                <Card><CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h5" color={c.color}>{c.value}</Typography>
                  <Typography variant="body2" color="text.secondary">{c.label}</Typography>
                </CardContent></Card>
              </Grid>
            ))}
          </Grid>

          {/* Pending Items */}
          <Typography variant="h6" gutterBottom>Pending Items</Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {pendingCards.map(c => (
              <Grid item xs={2} key={c.label}>
                <Card><CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h5" color={c.color}>{c.value}</Typography>
                  <Typography variant="body2" color="text.secondary">{c.label}</Typography>
                </CardContent></Card>
              </Grid>
            ))}
          </Grid>

          {/* KPIs */}
          <Typography variant="h6" gutterBottom>Key Performance Indicators</Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {kpiCards.map(c => (
              <Grid item xs={2.4} key={c.label}>
                <Card><CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h5" color={c.color}>{c.value}</Typography>
                  <Typography variant="body2" color="text.secondary">{c.label}</Typography>
                </CardContent></Card>
              </Grid>
            ))}
          </Grid>

          {/* Monthly Trend */}
          <Typography variant="h6" gutterBottom>Monthly Trend (6 months)</Typography>
          <TableContainer component={Paper} sx={{ mb: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Month</TableCell>
                  <TableCell align="right">Receipts</TableCell>
                  <TableCell align="right">Issues</TableCell>
                  <TableCell align="right">Transfers</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {trend.map((t: any) => (
                  <TableRow key={t.month}>
                    <TableCell><strong>{t.month}</strong></TableCell>
                    <TableCell align="right">{t.receipts}</TableCell>
                    <TableCell align="right">{t.issues}</TableCell>
                    <TableCell align="right">{t.transfers}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Bottom: Low Stock + Recent Activities */}
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Typography variant="h6" gutterBottom>Low Stock Items ({lowStock.length})</Typography>
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow><TableCell>Item</TableCell><TableCell>Code</TableCell><TableCell align="right">Current</TableCell><TableCell align="right">Min</TableCell></TableRow>
                  </TableHead>
                  <TableBody>
                    {lowStock.slice(0, 10).map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.itemName}</TableCell>
                        <TableCell>{item.itemCode}</TableCell>
                        <TableCell align="right"><Chip size="small" label={item.currentStock} color={item.currentStock <= 0 ? 'error' : 'warning'} /></TableCell>
                        <TableCell align="right">{item.minStock}</TableCell>
                      </TableRow>
                    ))}
                    {lowStock.length === 0 && <TableRow><TableCell colSpan={4} align="center">All items above minimum stock</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="h6" gutterBottom>Recent Activities</Typography>
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow><TableCell>Voucher</TableCell><TableCell>Type</TableCell><TableCell>Date</TableCell><TableCell>By</TableCell></TableRow>
                  </TableHead>
                  <TableBody>
                    {(dash.recentActivities || []).slice(0, 10).map((a: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell><strong>{a.voucherNo}</strong></TableCell>
                        <TableCell><Chip size="small" label={a.voucherType} /></TableCell>
                        <TableCell>{formatDateDDMMYYYY(new Date(a.transactionDate))}</TableCell>
                        <TableCell>{a.createdBy}</TableCell>
                      </TableRow>
                    ))}
                    {(!dash.recentActivities || dash.recentActivities.length === 0) && <TableRow><TableCell colSpan={4} align="center">No recent activity</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
          </Grid>

          {/* Top Problematic Assets */}
          {topProblematic.length > 0 && (
            <>
              <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>Top Problematic Assets</Typography>
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow><TableCell>Asset Code</TableCell><TableCell>Name</TableCell><TableCell align="right">Health</TableCell><TableCell align="right">Repairs</TableCell><TableCell align="right">Cost</TableCell></TableRow>
                  </TableHead>
                  <TableBody>
                    {topProblematic.map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell>{a.assetCode}</TableCell>
                        <TableCell>{a.assetName}</TableCell>
                        <TableCell align="right"><Chip size="small" label={`${a.healthScore}%`} color={a.healthScore < 30 ? 'error' : a.healthScore < 60 ? 'warning' : 'success'} /></TableCell>
                        <TableCell align="right">{a.repairCount}</TableCell>
                        <TableCell align="right">₹{Number(a.totalRepairCost).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </>
      )}
    </Box>
  );
}
