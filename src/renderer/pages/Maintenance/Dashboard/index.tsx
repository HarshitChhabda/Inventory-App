import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, Alert, LinearProgress, Button, Badge
} from '@mui/material';
import { Build, Warning, Schedule, Assignment, TrendingUp, Search } from '@mui/icons-material';
import { formatDateDDMMYYYY } from '../../../utils/dateUtils';
import StatusBadge from '../../../components/StatusBadge';

declare global { interface Window { electronAPI: any } }

const PRIORITY_COLORS: Record<string, string> = { CRITICAL: 'error', HIGH: 'warning', MEDIUM: 'info', LOW: 'success' };

export default function MaintenanceDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [srDashboard, setSrDashboard] = useState<any>({});
  const [woDashboard, setWoDashboard] = useState<any>({});
  const [reminders, setReminders] = useState<any>({});
  const [healthAlerts, setHealthAlerts] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const companyId = 1;
      const [srDash, woDash, rem] = await Promise.all([
        window.electronAPI.serviceRequestDashboard(companyId),
        window.electronAPI.workOrderDashboard(companyId),
        window.electronAPI.getUpcomingReminders(companyId, 14),
      ]);
      setSrDashboard(srDash); setWoDashboard(woDash); setReminders(rem);
      setLoading(false);
    };
    load();
  }, []);

  const statCards = [
    { label: 'Pending Requests', value: srDashboard.pending || 0, icon: <Assignment />, color: 'info.main' },
    { label: 'In Progress', value: srDashboard.inProgress || 0, icon: <Build />, color: 'warning.main' },
    { label: 'Waiting Parts', value: srDashboard.waitingParts || 0, icon: <Warning />, color: 'secondary.main' },
    { label: 'Overdue Orders', value: woDashboard.overdue || 0, icon: <Warning />, color: 'error.main' },
    { label: 'Completed Today', value: srDashboard.completedToday || 0, icon: <Build />, color: 'success.main' },
    { label: 'Total Spend', value: `₹${(woDashboard.totalCost || 0).toLocaleString()}`, icon: <TrendingUp />, color: 'primary.main' },
  ];

  const upcomingServices = reminders.upcomingServices || [];
  const expiringAMCs = reminders.expiringAMCs || [];
  const overdueWOs = reminders.overdueWorkOrders || [];
  const expiringWarranties = reminders.expiringWarranties || [];

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>Maintenance Dashboard</Typography>

      {loading ? <LinearProgress /> : (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {statCards.map(s => (
              <Grid item xs={2} key={s.label}>
                <Card><CardContent sx={{ textAlign: 'center' }}>
                  <Box color={s.color} mb={1}>{s.icon}</Box>
                  <Typography variant="h5" color={s.color}>{s.value}</Typography>
                  <Typography variant="body2" color="text.secondary">{s.label}</Typography>
                </CardContent></Card>
              </Grid>
            ))}
          </Grid>

          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <Schedule color="primary" />
                <Typography variant="h6" fontWeight={600}>Upcoming Services</Typography>
                <Badge badgeContent={upcomingServices.length} color="primary" sx={{ ml: 1 }} />
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead><TableRow><TableCell>Asset</TableCell><TableCell>Service Type</TableCell><TableCell>Frequency</TableCell><TableCell>Next Due</TableCell></TableRow></TableHead>
                  <TableBody>
                    {upcomingServices.map((s: any) => (
                      <TableRow key={s.id}>
                        <TableCell>{s.asset?.assetName || '-'}</TableCell>
                        <TableCell><Chip size="small" label={s.serviceType} /></TableCell>
                        <TableCell>{s.frequency}</TableCell>
                        <TableCell>{formatDateDDMMYYYY(new Date(s.nextDueDate))}</TableCell>
                      </TableRow>
                    ))}
                    {upcomingServices.length === 0 && <TableRow><TableCell colSpan={4} align="center">No upcoming services</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>

          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <Warning color="warning" />
                <Typography variant="h6" fontWeight={600}>AMC Expiring</Typography>
                <Badge badgeContent={expiringAMCs.length} color="warning" sx={{ ml: 1 }} />
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead><TableRow><TableCell>Asset</TableCell><TableCell>Vendor</TableCell><TableCell>End Date</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
                  <TableBody>
                    {expiringAMCs.map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell>{a.asset?.assetName || '-'}</TableCell>
                        <TableCell>{a.vendorName || '-'}</TableCell>
                        <TableCell>{formatDateDDMMYYYY(new Date(a.endDate))}</TableCell>
                        <TableCell><StatusBadge status={a.status} /></TableCell>
                      </TableRow>
                    ))}
                    {expiringAMCs.length === 0 && <TableRow><TableCell colSpan={4} align="center">No AMCs expiring</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>

          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <Warning color="info" />
                <Typography variant="h6" fontWeight={600}>Warranty Expiring</Typography>
                <Badge badgeContent={expiringWarranties.length} color="info" sx={{ ml: 1 }} />
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead><TableRow><TableCell>Asset</TableCell><TableCell>Asset Code</TableCell><TableCell>Warranty Expiry</TableCell></TableRow></TableHead>
                  <TableBody>
                    {expiringWarranties.map((w: any) => (
                      <TableRow key={w.id}>
                        <TableCell>{w.assetName}</TableCell>
                        <TableCell>{w.assetCode}</TableCell>
                        <TableCell>{w.warrantyEnd ? formatDateDDMMYYYY(new Date(w.warrantyEnd)) : '-'}</TableCell>
                      </TableRow>
                    ))}
                    {expiringWarranties.length === 0 && <TableRow><TableCell colSpan={3} align="center">No warranties expiring</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>

          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <Assignment color="error" />
                <Typography variant="h6" fontWeight={600}>Overdue Work Orders</Typography>
                <Badge badgeContent={overdueWOs.length} color="error" sx={{ ml: 1 }} />
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead><TableRow><TableCell>Work Order #</TableCell><TableCell>Asset</TableCell><TableCell>Engineer</TableCell><TableCell>Expected</TableCell></TableRow></TableHead>
                  <TableBody>
                    {overdueWOs.map((wo: any) => (
                      <TableRow key={wo.id}>
                        <TableCell><strong>{wo.workOrderNumber}</strong></TableCell>
                        <TableCell>{wo.asset?.assetName || '-'}</TableCell>
                        <TableCell>{wo.engineerName || '-'}</TableCell>
                        <TableCell>{wo.expectedCompletion ? formatDateDDMMYYYY(new Date(wo.expectedCompletion)) : '-'}</TableCell>
                      </TableRow>
                    ))}
                    {overdueWOs.length === 0 && <TableRow><TableCell colSpan={4} align="center">No overdue work orders</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  );
}
