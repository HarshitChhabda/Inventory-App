import React from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent, Avatar,
  List, ListItem, ListItemAvatar, ListItemText, Chip, Stack,
} from '@mui/material';
import {
  ShoppingCart, LocalShipping, TrendingUp, Warning, CheckCircle,
  Business, AttachMoney, Schedule,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '../../../context/CompanyContext';
import { MetricCardsSkeleton, CardSkeleton } from '../../../components/LoadingSkeleton';

export default function PurchaseDashboardPage() {
  const { company } = useCompany();
  const companyId = company?.id || 1;

  const { data: vendorDash, isLoading: vendorLoading } = useQuery({
    queryKey: ['vendorDashboard', companyId],
    queryFn: () => window.electronAPI.getVendorPDashboard(companyId),
  });

  const { data: poDash, isLoading: poLoading } = useQuery({
    queryKey: ['poDashboard', companyId],
    queryFn: () => window.electronAPI.getPODashboard(companyId),
  });

  const { data: grnDash, isLoading: grnLoading } = useQuery({
    queryKey: ['grnDashboard', companyId],
    queryFn: () => window.electronAPI.getGRNDashboard(companyId),
  });

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight={700} mb={1}>Procurement Dashboard</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>Overview of purchases, vendors, and deliveries</Typography>

      {/* Top Stats */}
      {vendorLoading || poLoading ? (
        <MetricCardsSkeleton count={6} />
      ) : (
      <Grid container spacing={2} mb={3}>
        {[
          { label: 'Active Vendors', value: vendorDash?.activeVendors || 0, icon: <Business />, color: '#6366F1' },
          { label: 'Pending POs', value: poDash?.pendingPOs || 0, icon: <ShoppingCart />, color: '#F59E0B' },
          { label: 'Pending Delivery', value: poDash?.orderedPOs || 0, icon: <LocalShipping />, color: '#3B82F6' },
          { label: 'Late Deliveries', value: poDash?.latePOs || 0, icon: <Warning />, color: '#EF4444' },
          { label: 'Completed POs', value: poDash?.completedPOs || 0, icon: <CheckCircle />, color: '#22C55E' },
          { label: 'Monthly Value', value: `₹${(poDash?.monthlyValue || 0).toLocaleString()}`, icon: <AttachMoney />, color: '#8B5CF6' },
        ].map((stat) => (
          <Grid item xs={6} sm={4} md={2} key={stat.label}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, py: 2 }}>
                <Avatar sx={{ bgcolor: stat.color + '20', color: stat.color, width: 48, height: 48 }}>{stat.icon}</Avatar>
                <Typography variant="h5" fontWeight={700} color={stat.color}>{stat.value}</Typography>
                <Typography variant="caption" color="text.secondary" textAlign="center">{stat.label}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      )}

      <Grid container spacing={3}>
        {/* GRN Stats */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} mb={2}>Goods Receipt Summary</Typography>
            {grnLoading ? (
              <Grid container spacing={2}>
                {[1,2,3,4].map((i) => (
                  <Grid item xs={6} key={i}><CardSkeleton /></Grid>
                ))}
              </Grid>
            ) : (
            <Grid container spacing={2}>
              {[
                { label: 'Total GRNs', value: grnDash?.totalGRNs || 0, color: 'primary.main' },
                { label: 'Pending QC', value: grnDash?.pendingQC || 0, color: 'warning.main' },
                { label: 'QC Passed', value: grnDash?.qcPassed || 0, color: 'success.main' },
                { label: 'Completed', value: grnDash?.completed || 0, color: 'info.main' },
              ].map((s) => (
                <Grid item xs={6} key={s.label}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center', py: 1 }}>
                      <Typography variant="h5" fontWeight={700} color={s.color}>{s.value}</Typography>
                      <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
            )}
          </Paper>
        </Grid>

        {/* Top Vendors */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} mb={2}>Top Vendors</Typography>
            {vendorLoading ? (
              <Stack spacing={2}>
                {[1,2,3].map((i) => <CardSkeleton key={i} />)}
              </Stack>
            ) : vendorDash?.topVendors?.length > 0 ? (
              <List dense>
                {vendorDash.topVendors.map((v: any, idx: number) => (
                  <ListItem key={idx}>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36, fontSize: 14 }}>
                        {v.vendorName?.charAt(0)}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={<Typography variant="body2" fontWeight={600}>{v.vendorName}</Typography>}
                      secondary={<Typography variant="caption">Rating: {v.vendorRating?.toFixed(1) || '0.0'} / 5</Typography>}
                    />
                    <Chip size="small" label={`★ ${v.vendorRating?.toFixed(1) || '0.0'}`} color="primary" variant="outlined" />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography color="text.secondary">No vendor data yet.</Typography>
            )}
          </Paper>
        </Grid>

        {/* Purchase Flow */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} mb={2}>Purchase Workflow</Typography>
            <Box display="flex" gap={2} flexWrap="wrap" justifyContent="center">
              {[
                { step: 'Purchase Request', color: '#6366F1' },
                { step: 'Approval', color: '#F59E0B' },
                { step: 'Quotation', color: '#8B5CF6' },
                { step: 'Vendor Selection', color: '#EC4899' },
                { step: 'Purchase Order', color: '#3B82F6' },
                { step: 'Goods Receipt', color: '#22C55E' },
                { step: 'Quality Check', color: '#14B8A6' },
                { step: 'Inventory Receipt', color: '#059669' },
                { step: 'Ledger Update', color: '#000000' },
              ].map((item, idx) => (
                <React.Fragment key={item.step}>
                  <Card variant="outlined" sx={{ minWidth: 120, textAlign: 'center' }}>
                    <CardContent sx={{ py: 1 }}>
                      <Typography variant="caption" fontWeight={600} color={item.color}>{item.step}</Typography>
                    </CardContent>
                  </Card>
                  {idx < 8 && <Typography variant="h6" color="text.secondary" sx={{ alignSelf: 'center' }}>→</Typography>}
                </React.Fragment>
              ))}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
