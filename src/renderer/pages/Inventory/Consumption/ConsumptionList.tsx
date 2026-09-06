import React, { useState } from 'react';
import {
  Box, Typography, Button, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, IconButton, Tooltip,
  alpha, useTheme, Grid, FormControl, InputLabel, Select, MenuItem,
  Skeleton, Stack,
} from '@mui/material';
import { Add, Visibility, Cancel, Search, Inventory, ArrowBack } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '../../../context/CompanyContext';
import PageHeader from '../../../components/PageHeader';
import EnterpriseDialog from '../../../components/EnterpriseDialog';
import EmptyState from '../../../components/EmptyState';
import { GuideButton } from '../../../components/GuideSystem';
import { formatDateDDMMYYYY } from '../../../utils/dateUtils';
import { toast } from 'react-hot-toast';

export default function ConsumptionList() {
  const { company, financialYear } = useCompany();
  const navigate = useNavigate();
  const theme = useTheme();

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelId, setCancelId] = useState(0);
  const [cancelReason, setCancelReason] = useState('');

  const { data, refetch, isLoading } = useQuery({
    queryKey: ['consumptions', company?.id, financialYear?.id, page, statusFilter],
    queryFn: () => window.electronAPI.findAllConsumptions(company!.id, financialYear!.id, {
      page,
      pageSize: 50,
      ...(statusFilter ? { status: statusFilter } : {}),
    }),
    enabled: !!company?.id && !!financialYear?.id,
  });

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      toast.error('Please enter a reason');
      return;
    }
    try {
      await window.electronAPI.cancelConsumption(cancelId, cancelReason);
      toast.success('Consumption cancelled');
      setCancelOpen(false);
      setCancelId(0);
      setCancelReason('');
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel');
    }
  };

  return (
    <Box p={3}>
      <PageHeader
        title="Material Consumption"
        subtitle="Track material used/consumed at locations"
        actions={
          <Stack direction="row" spacing={1}>
            <GuideButton pageId="consumption" />
            <Tooltip title="Back to Material Operations">
              <IconButton onClick={() => navigate('/inventory/movement')} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
                <ArrowBack fontSize="small" />
              </IconButton>
            </Tooltip>
            <Button startIcon={<Add />} variant="contained" onClick={() => navigate('/inventory/consumption/new')}>
              New Consumption
            </Button>
          </Stack>
        }
      />

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Status</InputLabel>
            <Select value={statusFilter} label="Status" onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="POSTED">Active</MenuItem>
              <MenuItem value="CANCELLED">Cancelled</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      <TableContainer component={Box} sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
              <TableCell sx={{ fontWeight: 700 }}>Consumption No</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Dharmshala</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Location</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Items</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Used By</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={`skel-${i}`}>
                  {[...Array(8)].map((_, j) => (
                    <TableCell key={j}><Skeleton variant="text" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : (data?.data || []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <EmptyState
                    icon={<Inventory />}
                    title="No consumption records"
                    description="Create a new consumption to track material used at locations."
                    action={{ label: 'New Consumption', onClick: () => navigate('/inventory/consumption/new'), icon: <Add /> }}
                    compact
                  />
                </TableCell>
              </TableRow>
            ) : (
              (data?.data || []).map((c: any) => (
              <TableRow key={c.id} hover>
                <TableCell>
                  <Typography fontWeight={500}>{c.consumptionNumber}</Typography>
                </TableCell>
                <TableCell>{formatDateDDMMYYYY(new Date(c.date))}</TableCell>
                <TableCell>{c.dharmshalaName || c.store?.name || '-'}</TableCell>
                <TableCell>{c.locationName || '-'}</TableCell>
                <TableCell>{c.items?.length || 0}</TableCell>
                <TableCell>{c.usedBy || '-'}</TableCell>
                <TableCell>
                  <Chip size="small" label={c.status}
                    color={c.status === 'POSTED' ? 'success' : c.status === 'CANCELLED' ? 'error' : 'default'}
                    sx={{ fontSize: '0.65rem', height: 20 }} />
                </TableCell>
                <TableCell>
                  <Tooltip title="View">
                    <IconButton size="small" onClick={() => navigate(`/inventory/consumption/${c.id}`)}>
                      <Visibility fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  {c.status === 'POSTED' && (
                    <Tooltip title="Cancel">
                      <IconButton size="small" color="error" onClick={() => { setCancelId(c.id); setCancelOpen(true); }}>
                        <Cancel fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
              )))}
          </TableBody>
        </Table>
      </TableContainer>

      {data && data.totalPages > 1 && (
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', gap: 1 }}>
          <Button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <Typography sx={{ alignSelf: 'center' }}>Page {page} of {data.totalPages}</Typography>
          <Button disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>Next</Button>
        </Box>
      )}

      <EnterpriseDialog open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel Consumption" maxWidth="sm"
        actions={
          <>
            <Button onClick={() => setCancelOpen(false)}>Close</Button>
            <Button variant="contained" color="error" onClick={handleCancel}>Confirm Cancel</Button>
          </>
        }>
        <TextField fullWidth label="Reason for cancellation" value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)} multiline rows={2} />
      </EnterpriseDialog>
    </Box>
  );
}
