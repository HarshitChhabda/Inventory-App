import React, { useState } from 'react';
import {
  Box, Typography, Button, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, IconButton, Tooltip,
  alpha, useTheme, Grid, FormControl, InputLabel, Select, MenuItem,
  Skeleton, Stack,
} from '@mui/material';
import { Add, Visibility, Cancel, Search, Build, ArrowBack } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '../../../context/CompanyContext';
import PageHeader from '../../../components/PageHeader';
import EnterpriseDialog from '../../../components/EnterpriseDialog';
import EmptyState from '../../../components/EmptyState';
import { GuideButton } from '../../../components/GuideSystem';
import { formatDateDDMMYYYY } from '../../../utils/dateUtils';
import { toast } from 'react-hot-toast';

export default function InstallationList() {
  const { company, financialYear } = useCompany();
  const navigate = useNavigate();
  const theme = useTheme();

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelId, setCancelId] = useState(0);
  const [cancelReason, setCancelReason] = useState('');

  const { data, refetch, isLoading } = useQuery({
    queryKey: ['installations', company?.id, financialYear?.id, page, statusFilter],
    queryFn: () => window.electronAPI.findAllInstallations(company!.id, financialYear!.id, {
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
      await window.electronAPI.cancelInstallation(cancelId, cancelReason);
      toast.success('Installation cancelled');
      setCancelOpen(false);
      setCancelId(0);
      setCancelReason('');
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'POSTED': return 'success';
      case 'CANCELLED': return 'error';
      default: return 'default';
    }
  };

  const installations = data?.data || [];
  const total = data?.total || 0;

  return (
    <Box>
      <PageHeader
        title="Material Installation"
        subtitle={`Track materials physically placed at locations (${total} records)`}
        actions={
          <Stack direction="row" spacing={1}>
            <GuideButton pageId="installation" />
            <Tooltip title="Back to Material Operations">
              <IconButton onClick={() => navigate('/inventory/movement')} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
                <ArrowBack fontSize="small" />
              </IconButton>
            </Tooltip>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => navigate('/inventory/installation/new')}
              sx={{ bgcolor: '#10B981', '&:hover': { bgcolor: '#059669' } }}
            >
              New Installation
            </Button>
          </Stack>
        }
      />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="POSTED">Posted</MenuItem>
              <MenuItem value="CANCELLED">Cancelled</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
              <TableCell sx={{ fontWeight: 700 }}>Installation #</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Store</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Location</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Items</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Installed By</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="center">Actions</TableCell>
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
            ) : installations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <EmptyState
                    icon={<Build />}
                    title="No installations"
                    description="Install materials at locations to track them."
                    action={{ label: 'New Installation', onClick: () => navigate('/inventory/installation/new'), icon: <Add /> }}
                    compact
                  />
                </TableCell>
              </TableRow>
            ) : (
              installations.map((inst: any) => (
              <TableRow key={inst.id} hover>
                <TableCell>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                    {inst.installationNumber}
                  </Typography>
                </TableCell>
                <TableCell>{formatDateDDMMYYYY(inst.date)}</TableCell>
                <TableCell>{inst.store?.name || '-'}</TableCell>
                <TableCell>{inst.location?.name || inst.locationName || '-'}</TableCell>
                <TableCell>{inst.items?.length || 0}</TableCell>
                <TableCell>{inst.installedBy || '-'}</TableCell>
                <TableCell>
                  <Chip
                    label={inst.status}
                    color={getStatusColor(inst.status) as any}
                    size="small"
                    variant="outlined"
                  />
                </TableCell>
                <TableCell align="center">
                  <Tooltip title="View Details">
                    <IconButton size="small" onClick={() => navigate(`/inventory/installation/${inst.id}`)}>
                      <Visibility fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  {inst.status === 'POSTED' && (
                    <Tooltip title="Cancel">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => { setCancelId(inst.id); setCancelOpen(true); }}
                      >
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
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, gap: 1 }}>
          <Button disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
          <Typography sx={{ alignSelf: 'center' }}>Page {page} of {data.totalPages}</Typography>
          <Button disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>Next</Button>
        </Box>
      )}

      <EnterpriseDialog
        open={cancelOpen}
        onClose={() => { setCancelOpen(false); setCancelId(0); setCancelReason(''); }}
        title="Cancel Installation"
        maxWidth="sm"
      >
        <Box sx={{ p: 2 }}>
          <Typography sx={{ mb: 2 }}>Are you sure you want to cancel this installation?</Typography>
          <TextField
            fullWidth
            label="Reason for cancellation"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            multiline
            rows={3}
            sx={{ mb: 2 }}
          />
          <Button
            variant="contained"
            color="error"
            onClick={handleCancel}
            disabled={!cancelReason.trim()}
          >
            Cancel Installation
          </Button>
        </Box>
      </EnterpriseDialog>
    </Box>
  );
}
