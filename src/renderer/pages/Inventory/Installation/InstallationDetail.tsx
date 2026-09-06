import React from 'react';
import {
  Box, Typography, Button, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Grid, Paper, alpha, useTheme,
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useCompany } from '../../../context/CompanyContext';
import PageHeader from '../../../components/PageHeader';
import { formatDateDDMMYYYY } from '../../../utils/dateUtils';

export default function InstallationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const { company } = useCompany();

  const { data: installation, isLoading } = useQuery({
    queryKey: ['installation', id],
    queryFn: () => window.electronAPI.findInstallationById(Number(id)),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <Box p={3}>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  if (!installation) {
    return (
      <Box p={3}>
        <Typography color="text.secondary">Installation not found</Typography>
        <Button onClick={() => navigate('/inventory/installation')} sx={{ mt: 2 }}>
          Back to List
        </Button>
      </Box>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'POSTED': return 'success';
      case 'CANCELLED': return 'error';
      default: return 'default';
    }
  };

  const totalInstalled = (installation.items || []).reduce(
    (sum: number, item: any) => sum + Number(item.quantityInstalled), 0
  );

  return (
    <Box p={3}>
      <PageHeader
        title={`Installation: ${installation.installationNumber}`}
        subtitle={`Recorded on ${formatDateDDMMYYYY(new Date(installation.date))}`}
        breadcrumbs={[
          { label: 'Inventory', path: '/inventory/installation' },
          { label: 'Installation', path: '/inventory/installation' },
          { label: installation.installationNumber },
        ]}
        actions={
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<ArrowBack />}
              onClick={() => navigate('/inventory/installation')}
            >
              Back
            </Button>
          </Stack>
        }
      />

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
              Installation Details
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">Installation No</Typography>
                <Typography fontWeight={500} sx={{ fontFamily: 'monospace' }}>
                  {installation.installationNumber}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">Status</Typography>
                <Box>
                  <Chip
                    label={installation.status}
                    color={getStatusColor(installation.status) as any}
                    size="small"
                    sx={{ fontSize: '0.75rem' }}
                  />
                </Box>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">Date</Typography>
                <Typography fontWeight={500}>
                  {formatDateDDMMYYYY(new Date(installation.date))}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">Store</Typography>
                <Typography fontWeight={500}>{installation.store?.name || '-'}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">Location</Typography>
                <Typography fontWeight={500}>
                  {installation.location?.name || installation.locationName || '-'}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">Department</Typography>
                <Typography fontWeight={500}>{installation.departmentName || '-'}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">Dharmshala</Typography>
                <Typography fontWeight={500}>{installation.dharmshalaName || '-'}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">Installed By</Typography>
                <Typography fontWeight={500}>{installation.installedBy || '-'}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">Approved By</Typography>
                <Typography fontWeight={500}>{installation.approvedBy || '-'}</Typography>
              </Grid>
              {installation.serviceRequest && (
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Demand Reference</Typography>
                  <Typography fontWeight={500}>
                    {installation.serviceRequest.physicalDemandNo || installation.serviceRequest.requestNumber || '-'}
                  </Typography>
                </Grid>
              )}
              {installation.remarks && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">Remarks</Typography>
                  <Typography fontWeight={500}>{installation.remarks}</Typography>
                </Grid>
              )}
            </Grid>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
              Summary
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={4}>
                <Box sx={{ textAlign: 'center', p: 1, bgcolor: alpha('#10B981', 0.1), borderRadius: 1 }}>
                  <Typography variant="h5" fontWeight={700} color="success.main">
                    {totalInstalled}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">Total Installed</Typography>
                </Box>
              </Grid>
              <Grid item xs={4}>
                <Box sx={{ textAlign: 'center', p: 1, bgcolor: alpha('#2563EB', 0.1), borderRadius: 1 }}>
                  <Typography variant="h5" fontWeight={700} color="primary.main">
                    {installation.items?.length || 0}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">Unique Items</Typography>
                </Box>
              </Grid>
              <Grid item xs={4}>
                <Box sx={{ textAlign: 'center', p: 1, bgcolor: alpha('#F59E0B', 0.1), borderRadius: 1 }}>
                  <Typography variant="h5" fontWeight={700} color="warning.main">
                    {installation.status === 'CANCELLED' ? 1 : 0}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">Cancelled</Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>

      <Paper variant="outlined" sx={{ p: 2, mt: 3 }}>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
          Installed Items
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Item</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Code</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Unit</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Qty Installed</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Condition</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Remarks</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(installation.items || []).map((item: any, idx: number) => (
                <TableRow key={item.id || idx}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell>
                    <Typography fontWeight={500}>{item.itemName}</Typography>
                  </TableCell>
                  <TableCell>{item.itemCode || '-'}</TableCell>
                  <TableCell>{item.unitName || '-'}</TableCell>
                  <TableCell align="right">
                    <Chip
                      label={Number(item.quantityInstalled)}
                      size="small"
                      sx={{ backgroundColor: alpha('#10B981', 0.1), color: '#059669' }}
                    />
                  </TableCell>
                  <TableCell>{item.condition || 'GOOD'}</TableCell>
                  <TableCell>{item.remarks || '-'}</TableCell>
                </TableRow>
              ))}
              {(!installation.items || installation.items.length === 0) && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    No items recorded
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
